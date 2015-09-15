'use strict';

var _ = require('lodash')
  , co = require('co')
  , globToRegex = require('glob-to-regexp')
  , db = require('../db')
  , error = require('../error')
  , util = require('../util')
  , parser = require('./parser')
  ;

/** Represents parsed document query. */
class Query {

  constructor(name, user) {
    this.name = name;
    this.user = user;
    this.fields = new Set();
    this.refs = {};
    this.arrayRefs = {};
    this.results = {};
  }

  static one(name, id, query, user) {
    let q = new OneQuery(name, user);
    if (query) {
      q.parseQuery(query);
    }
    return q.executeOne(id);
  }

  static many(name, query, user) {
    let q = new ManyQuery(name, user);
    if (query) {
      q.parseQuery(query);
    }
    return q.executeMany();
  }

  static _parseSelector(select) {
    try {
      return util.switchStringArrayObject(select, {
        string: () => parser.parse(select),
        array: () => select.map(Query._parseSelector),
        object: () => {
          if (select.select) {
            select.select = Query._parseSelector(select.select);
          }
          return select;
        }
      });
    } catch (e) {
      throw error(400, "Bad select: " + e.message);
    }
  }

  parseQuery(query) {
    if (query.select) {
      // recursively resolve all select syntax sugar
      query.select = Query._parseSelector(query.select);
    }
    this.loadQuery(query);
  }

  loadQuery(query) {
    if ('select' in query) {
      this.loadSelector(query.select);
    } else {
      this.fullData = true;
    }
  }

  loadSelector(selector) {
    this.select = selector;
    util.switchStringArrayObject(selector, {
      string: () => {
        if (selector === '*') {
          this.fullData = true;
        } else {
          this.fields.add(selector);
        }
      },
      array: () => {
        for (let field of selector) {
          this.loadSelector(field);
        }
        // set select to original value since the recursive call could have overridden it
        this.select = selector;
      },
      object: () => {
        let refQuery;
        if ('ref' in selector) {
          if (!(selector.ref in this.refs)) {
            // we are not yet loading data for this ref, so create query for it
            this.refs[selector.ref] = new OneQuery(selector.ref, this.user);
          }
          refQuery = this.refs[selector.ref];
        } else if ('many_ref' in selector) {
          if (!(selector.many_ref in this.arrayRefs)) {
            // we are not yet loading data for this many_ref, so create query for it
            this.arrayRefs[selector.many_ref] = new ManyQuery(selector.many_ref, this.user);
          }
          refQuery = this.arrayRefs[selector.many_ref];
        } else {
          throw error(400, "Bad Query: No 'ref' or 'many_ref' specified in nested query.");
        }
        refQuery.loadQuery(selector);
      }
    });
  }

  getRequiredFieldsQuery() {
    let query;
    if (this.fullData || (this.fields.size === 0 && util.isEmptyObject(this.refs) && util.isEmptyObject(this.arrayRefs))) {
      query = _.cloneDeep(db.NO_MONGO_ID);
      if (this.user) {
        query.fields._acl = 0;
      }
    } else {
      query = db.queryFields(this.getRequiredFields().concat(['id']));
      query.fields._acl = this.user ? 0 : 1;
    }

    return query;
  }

  applyAcl(filter) {
    if (this.user && this.user !== '*') {
      filter._acl = this.user;
    }

    return filter;
  }

  getRequiredFields() {
    const directFields = util.setToArray(this.fields);
    const refFields = Object.keys(this.refs);
    const arrayRefFields = Object.keys(this.arrayRefs);
    return directFields.concat(refFields).concat(arrayRefFields);
  }

  getEntityLoadPromise(entity) {
    let promises = {};
    promises.refs = util.keyedPromise(this.refs, (ref, query) => {
      return Query._isValidLink(entity[ref]) && query.loadEntityData(entity[ref].toString());
    });
    promises.arrayRefs = util.keyedPromise(this.arrayRefs, (ref, query) => {
      if (_.isArray(entity[ref])) {
        return query.loadEntityCollectionData(entity.id, {id: { $in: util.setToArray(entity[ref]).map(id => id.toString()) }});
      } else {
        return query.loadEntityCollectionData(entity.id, db.filterLink(this.name, entity.id));
      }
    });

    return promises;
  }

  static _isValidLink(val) {
    return _.isNumber(val) || _.isString(val);
  }

  static pickRefFields(refData, select) {
    return _.contains(select, '*') ? refData : _.pick(refData, select);
  }

  resolveEntityReferences(obj, entity, prefix) {
    entity = entity || obj;
    prefix = prefix || '';

    if (_.isString(this.select)) {
      obj[`${prefix}${this.select}`] = entity[this.select];
    } else {

      let selects = _.isArray(this.select) ? this.select.filter(_.isObject) : [this.select];

      selects.forEach(select => {
        let subSelect = select.select;
        if ('ref' in select) {
          let refQuery = this.refs[select.ref];
          let refData = refQuery.results[entity[select.ref]];
          if (refData && subSelect) {
            util.switchStringArrayObject(subSelect, {
              string: () => {
                obj[`${prefix}@${select.ref}.${subSelect}`] = refData[subSelect];
              },
              array: () => {
                let refObj = Query.pickRefFields(refData, subSelect);
                obj[`${prefix}@${select.ref}`] = refObj;
                refQuery.resolveEntityReferences(refObj, refData);
              },
              object: () => {
                refQuery.resolveEntityReferences(obj, refData, `${prefix}@${select.ref}.`);
              }
            });
          } else {
            // direct object embedding
            obj[`${prefix}@${select.ref}`] = refData;
          }
        } else if ('many_ref' in select) {
          let refQuery = this.arrayRefs[select.many_ref];
          let refData = refQuery.results[entity.id];
          if (refData && subSelect) {
            util.switchStringArrayObject(subSelect, {
              string: () => {
                obj[`${prefix}@[${select.many_ref}].${subSelect}`] = refData.filter(e => e[subSelect]).map(e => e[subSelect]);
              },
              array: () => {
                obj[`${prefix}@[${select.many_ref}]`] = refData.map(refEntity => {
                  let refObj = Query.pickRefFields(refEntity, subSelect);
                  refQuery.resolveEntityReferences(refObj, refEntity);
                  return refObj;
                });
              },
              object: () => {
                // ugly workaround to get array of nested references
                let resolved = refData.map(refEntity => {
                  let refObj = {};
                  refQuery.resolveEntityReferences(refObj, refEntity, `${prefix}@[${select.many_ref}].`);
                  return refObj;
                });
                if (resolved.length) {
                  let keys = Object.keys(resolved[0]);
                  if (keys.length !== 1) {
                    throw new Error("Assertion failed: expected unique key");
                  }
                  obj[keys[0]] = resolved.filter(res => res[keys[0]]).map(res => res[keys[0]]);
                }
              }
            });
          } else {
            // direct collection embedding
            obj[`${prefix}@[${select.many_ref}]`] = refData;
          }
        }
      });
    }

    // strip unwanted fields
    if (!this.fullData) {
      for (let key of Object.keys(obj)) {
        if (!this.fields.has(key) && !key.startsWith('@')) {
          delete obj[key];
        }
      }
    }
  }
}

class OneQuery extends Query {

  loadEntityData(id) {
    let q = this;
    return co(function *() {
      // if we have already loaded this data with the same id, return cached result
      if (q.results[id]) {
        return q.results[id];
      }
      let entity = yield db.get(q.name).findOne(q.applyAcl({id}), q.getRequiredFieldsQuery());
      q.results[id] = entity;
      if (entity) {
        yield q.getEntityLoadPromise(entity);
      }
      return entity;
    });
  }

  executeOne(id) {
    let q = this;
    return co(function *() {
      let entity = yield q.loadEntityData(id);
      if (q.select) {
        q.resolveEntityReferences(entity);
      }
      return entity;
    });
  }
}

class ManyQuery extends Query {

  loadQuery(query) {
    super.loadQuery(query);

    if ('where' in query) {
      this.filter = ManyQuery._parseFilter(query.where);
    }
    if ('orderBy' in query) {
      this.sort = ManyQuery._parseSort(query.orderBy);
    }
    if ('limit' in query) {
      this.limit = parseInt(query.limit);
    }
    if ('skip' in query) {
      this.skip = parseInt(query.skip);
    }
  }

  static _parseFilter(where) {
    let filter = {};
    for (let key of Object.keys(where)) {
      filter[key] = ManyQuery._getFilterValue(where[key]);
    }
    return filter;
  }

  static _getFilterValue(value) {
    if (ManyQuery._isGlob(value)) {
      // extended to support '?', '{}', and '[]' in glob
      // 'i' to make matching case invariant
      return globToRegex(value, {extended: true, flags: 'i'});
    } else {
      return value;
    }
  }

  static _isGlob(value) {
    return /[*?[{]/.test(value);
  }

  static _parseSort(order) {
    if (!_.isArray(order)) {
      order = [order];
    }
    return order.map(expr => {
      // order expression is name of the field,
      // optionally prefixed with '-' for reversing the sort direction */
      if (expr[0] === '-') {
        return [expr.slice(1), 'desc'];
      } else {
        return [expr, 'asc'];
      }
    });
  }

  getMongoQuery() {
    let query = this.getRequiredFieldsQuery();
    if (this.limit) {
      query.limit = this.limit;
    }
    if (this.skip) {
      query.skip = this.skip;
    }
    if (this.sort) {
      query.sort = this.sort;
    }
    return query;
  }

  getFilter(filter) {
    // start with user supplied filter but override if custom filter is supplied
    // during many_ref resolution
    filter = _.assign(this.filter || {}, filter);

    return this.applyAcl(filter);
  }

  loadEntityCollectionData(parentId, filter) {
    let q = this;
    return co(function *() {
      if (q.results[parentId]) {
        return q.results[parentId];
      }

      let entities = yield db.get(q.name).find(q.getFilter(filter), q.getMongoQuery());
      q.results[parentId] = entities;
      yield entities.map(q.getEntityLoadPromise.bind(q));
      return entities;
    });
  }

  executeMany() {
    let q = this;
    return co(function *() {
      let entities = yield q.loadEntityCollectionData();
      if (q.select) {
        for (let entity of entities) {
          q.resolveEntityReferences(entity);
        }
      }
      return entities;
    });
  }
}

module.exports = Query;
