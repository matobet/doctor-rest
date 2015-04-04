'use strict';

var _ = require('lodash')
  , co = require('co')
  , db = require('../db')
  , error = require('../error')
  , util = require('../util')
  ;

/** Represents parsed document query. */
class Query {

  constructor() {
    this.fields = [];
    this.refs = new Set();
    this.refEmbed = new Set();
    this.refFields = {};
  }

  static parse(query) {
    if (!query) {
      return null;
    }

    let q = new Query();
    if (query.select) {
      for (let field of query.select) {
        if (field.startsWith('@')) {
          let path = field.slice(1).split('.');
          let ref = path[0];
          q.refs.add(ref);
          if (path.length === 1) {
            q.refEmbed.add(ref);
          } else if (path.length === 2) {
            if (!(ref in q.refFields)) {
              q.refFields[ref] = [];
            }
            q.refFields[ref].push(path[1]);
          } else {
            throw error(400, 'Nested references of depth > 1 are not supported');
          }
        } else {
          q.fields.push(field);
        }
      }
    }
    return q;
  }

  getAll(name) {
    let q = this;
    return co(function *() {
      let entities = yield db.get(name).find({}, q.getFieldQuery(['_links']));
      let refEntities = yield util.keyedPromise(q.collectRefs(entities),
        (ref, idSet) => db.get(ref).find({id: { $in: util.setToArray(idSet) }}, q.getRefFieldQuery(ref, 'id')).then(util.byId));

      return entities.map(entity => q.resolveEntityRefs(entity,
          ref => refEntities[ref][entity._links[ref]]));
    });
  }

  getOne(name, id) {
    let q = this;
    return co(function *() {
      let entity = yield db.get(name).findOne({id}, q.getFieldQuery(['_links']));
      if (!_.isObject(entity._links)) {
        return entity;
      }
      // if entity has links resolve queried references
      let refEntities = yield util.keyedPromise(entity._links,
        (ref, refId) => db.get(ref).findOne({id: refId.toString()}, q.getRefFieldQuery(ref)));

      return q.resolveEntityRefs(entity, ref => refEntities[ref]);
    });
  }

  /**
   * Returns mongo query for direct fields of queried root entity (i.e. all non referential fields).
   * @param {String[]} [extraFields=[]] - optional extra fields to query from root entity (in addition to those specified in this query).
   * @returns {Object} Monk selector for given fields
   */
  getFieldQuery(extraFields) {
    return db.queryFields(this.fields.concat(extraFields || []));
  }

  /**
   * Returns mongo query for fields of given `ref`.
   * @param {String} ref Name of document reference (used in _links object)
   * @param {String[]} [extraFields=[]] - optional extra fields to query from referenced entity (in addition to those specified in this query).
   * @returns {Object} Monk selector for given fields.
   */
  getRefFieldQuery(ref, extraFields) {
    // if query embeds this ref, we want to fetch whole object
    if (this.refEmbed.has(ref)) {
      return db.NO_MONGO_ID;
    }
    return db.queryFields(this.refFields[ref].concat(extraFields || []));
  }

  collectRefs(entities) {
    let refCollections = {};
    for (let ref of this.refs) {
      refCollections[ref] = new Set();
    }
    for (let entity of entities) {
      if (!_.isObject(entity._links)) {
        continue;
      }
      var self = this;
      _.forEach(entity._links, (refId, ref) => {
        if (self.refs.has(ref)) {
          refCollections[ref].add(refId.toString());
        }
      });
    }
    return refCollections;
  }

  resolveEntityRefs(entity, resolve) {
    for (let ref of this.refEmbed) {
      if (entity._links[ref]) {
        entity[`@${ref}`] = resolve(ref);
      }
    }

    for (let ref of Object.keys(this.refFields)) {
      if (entity._links[ref]) {
        for (let field of this.refFields[ref]) {
          entity[`@${ref}.${field}`] = resolve(ref)[field];
        }
      }
    }

    // don't return _links unless explicitly queried
    if (!_.includes(this.fields, '_links')) {
      delete entity._links;
    }

    return entity;
  }
}

module.exports = Query;
