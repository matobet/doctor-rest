'use strict';

var _ = require('lodash')
  , co = require('co')
  , db = require('../db')
  , error = require('../error')
  , util = require('../util')
  , parser = require('./parser')
  ;

/** Represents parsed document query. */
class Query {

  constructor(name, permission) {
    this.name = name;
    this.permission = permission;
    this.fields = new Set();
    this.refs = {};
    this.arrayRefs = {};
    this.results = {};
  }

  static one(name, id, query, permission) {
    let q = new Query(name, permission);
    if (query && query.select) {
      q.parseSelect(query.select);
    }
    return q.executeOne(id);
  }

  static many(name, query, permission) {
    let q = new Query(name, permission);
    if (query && query.select) {
      q.parseSelect(query.select);
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

  parseSelect(select) {
    this.select = Query._parseSelector(select);
    this.loadSelector(this.select);
  }

  loadSelector(selector) {
    let q = this;
    util.switchStringArrayObject(selector, {
      string: () => {
        if (selector === '*') {
          q.fullData = true;
        } else {
          q.fields.add(selector);
        }
      },
      array: () => {
        for (let field of selector) {
          q.loadSelector(field);
        }
      },
      object: () => {
        let refQuery;
        if ('ref' in selector) {
          if (!(selector.ref in q.refs)) {
            // we are not yet loading data for this ref, so create query for it
            q.refs[selector.ref] = new Query(selector.ref, q.permission);
          }
          refQuery = q.refs[selector.ref];
        } else if ('many_ref' in selector) {
          if (!(selector.many_ref in q.arrayRefs)) {
            // we are not yet loading data for this many_ref, so create query for it
            q.arrayRefs[selector.many_ref] = new Query(selector.many_ref, q.permission);
          }
          refQuery = q.arrayRefs[selector.many_ref];
        } else {
          throw error(400, "Bad Query: No 'ref' or 'many_ref' specified in nested object.");
        }
        // if 'ref' has it's own subSelect, load it
        if ('select' in selector) {
          refQuery.select = selector.select;
          refQuery.loadSelector(selector.select);
        } else {
          // otherwise mark that we need to load full data for this 'ref'
          refQuery.fullData = true;
        }
      }
    });
  }

  getRequiredFieldsQuery() {
    if (this.fullData || (this.fields.size === 0 && util.isEmptyObject(this.refs) && util.isEmptyObject(this.arrayRefs))) {
      return db.NO_MONGO_ID;
    }
    return db.queryFields(this.getRequiredFields().concat(['id']));
  }

  getRequiredFields() {
    const directFields = util.setToArray(this.fields);
    const refFields = Object.keys(this.refs);
    const arrayRefFields = Object.keys(this.arrayRefs);
    return directFields.concat(refFields).concat(arrayRefFields);
  }

  getEntityLoadPromise(entity) {
    let q = this;
    let promises = {};
    promises.refs = util.keyedPromise(q.refs, (ref, query) => {
      return Query._isValidLink(entity[ref]) && query.loadEntityData(entity[ref].toString());
    });
    promises.arrayRefs = util.keyedPromise(q.arrayRefs, (ref, query) => {
      if (_.isArray(entity[ref])) {
        return query.loadEntityCollectionData(entity.id, {id: { $in: util.setToArray(entity[ref]).map(id => id.toString()) }});
      } else {
        return query.loadEntityCollectionData(entity.id, db.filterLink(q.name, entity.id));
      }
    });

    return promises;
  }

  static _isValidLink(val) {
    return _.isNumber(val) || _.isString(val);
  }

  loadEntityData(id) {
    let q = this;
    if (!q.permission.check(q.name, id)) {
      throw error(403);
    }
    return co(function *() {
      // if we have already loaded this data with the same id, return cached result
      if (q.results[id]) {
        return q.results[id];
      }
      let entity = yield db.get(q.name).findOne({id}, q.getRequiredFieldsQuery());
      q.results[id] = entity;
      if (entity) {
        yield q.getEntityLoadPromise(entity);
      }
      return entity;
    });
  }

  loadEntityCollectionData(parentId, filter) {
    let q = this;
    return co(function *() {
      if (q.results[parentId]) {
        return q.results[parentId];
      }
      filter = filter || {};

      if (q.permission.restricts(q.name)) {
        let idWhiteList = q.permission.getIdWhiteListFor(q.name);
        if (!('id' in filter)) {
          filter.id = { $in: idWhiteList };
        } else {
          // here we assume that 'id' field is filtered always using the $in operator
          let requestedIds = filter.id.$in;
          let idSet = util.arrayToSet(idWhiteList);
          for (let id of requestedIds) {
            if (!idSet.has(id)) {
              throw error(403);
            }
          }
        }
      }

      let entities = yield db.get(q.name).find(filter, q.getRequiredFieldsQuery());
      q.results[parentId] = entities;
      yield entities.map(q.getEntityLoadPromise.bind(q));
      return entities;
    });
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

      let q = this;
      selects.forEach(select => {
        let subSelect = select.select;
        if ('ref' in select) {
          let refQuery = q.refs[select.ref];
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
          let refQuery = q.arrayRefs[select.many_ref];
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
