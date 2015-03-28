'use strict';

var _ = require('lodash')
  , db = require('../db')
  , error = require('../error')
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

  static _getMongoQuery(fields) {
    let mongoQuery = _.cloneDeep(db.NO_MONGO_ID);
    if (fields) {
      for (let field of fields) {
        mongoQuery.fields[field] = 1;
      }
    }
    return mongoQuery;
  }

  /**
   * Returns mongo query for direct fields of queried root entity (i.e. all non referential fields).
   * @param {String[]} [extraFields=[]] - optional extra fields to query from root entity (in addition to those specified in this query).
   * @returns {Object} Monk selector for given fields
   */
  getFieldQuery(extraFields) {
    return Query._getMongoQuery(this.fields.concat(extraFields || []));
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
    return Query._getMongoQuery(this.refFields[ref].concat(extraFields || []));
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
