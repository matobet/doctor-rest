'use strict';

var co = require('co')
  , _ = require('lodash')
  , db = require('../db')
  , Query = require('../query')
  , util = require('../util')
  , error = require('../error')
  , diff = require('./diff')
  , push = require('./push')
  ;

function checkPayload(data) {
  if (!data) {
    throw error(400, "Request body cannot be empty.");
  }
}

function checkId(entity) {
  if (!('id' in entity)) {
    throw error(400, "Document needs to contain the 'id' attribute.");
  }
  // ensure persisted id is String
  entity.id = entity.id.toString();
}

const manager = module.exports = {
  getCollection(name, query) {
    let q = Query.parse(query);
    if (!q) {
      return db.get(name).find({}, db.NO_MONGO_ID);
    }
    return co(function *() {
      let entities = yield db.get(name).find({}, q.getFieldQuery(['_links']));
      let refEntities = yield util.keyedPromise(q.collectRefs(entities),
        (ref, idSet) => db.get(ref).find({id: { $in: util.setToArray(idSet) }}, q.getRefFieldQuery(ref, 'id')).then(util.byId));

      return entities.map(entity => q.resolveEntityRefs(entity,
          ref => refEntities[ref][entity._links[ref]]));
    });
  },

  getOne(name, id, query) {
    let q = Query.parse(query);
    if (!q) {
      return db.get(name).findOne({id}, db.NO_MONGO_ID);
    }
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
  },

  create(name, entity) {
    checkPayload(entity);
    checkId(entity);
    return co(function *() {
      let existing = yield manager.getOne(name, entity.id);
      if (existing) {
        return manager.replace(name, entity.id, entity);
      } else {
        push.create(name, entity.id);
        return db.get(name).insert(entity);
      }
    });
  },

  patch(name, id, data) {
    checkPayload(data);
    if ('id' in data && data.id !== id) {
      throw error(400, "Document id cannot be patched.");
    }
    return co(function *() {
      let existing = yield manager.getOne(name, id);
      if (!existing) {
        throw error(404, "Cannot patch non-existing document.");
      }
      push.deltaUpdate(name, id, diff.object(existing, data));
      return db.get(name).update({id}, {$set: data});
    });
  },

  replaceCollection(name, entities) {
    if (!Array.isArray(entities)) {
      throw error(400, "Request must contain an array.");
    }
    if (entities === []) {
      return manager.removeCollection(name);
    }
    entities.map(checkId);
    return co(function *() {
      let existing = yield manager.getCollection(name);
      let created = true;
      if (existing.length !== 0) {
        yield db.clear(name);
        created = false;
      }
      var diffs = diff.array(existing, entities);
      diffs.created.forEach(id => push.create(name, id));
      diffs.updated.forEach(diff => push.deltaUpdate(name, diff.id, diff));
      diffs.deleted.forEach(id => push.delete(name, id));
      yield db.get(name).insert(entities);
      return created;
    });
  },

  replace(name, id, entity) {
    checkPayload(entity);
    checkId(entity);
    if (id !== entity.id) {
      throw error(400, "Document id must match last segment of document URL.");
    }
    return co(function *() {
      let existing = yield manager.getOne(name, id);
      if (!existing) {
        yield manager.create(name, entity);
        return true;
      }
      push.deltaUpdate(name, id, diff.object(existing, entity));
      yield db.get(name).update({id}, entity);
      return false;
    });
  },

  removeCollection(name) {
    return co(function *() {
      const existing = yield db.get(name).find({}, db.ID_ONLY);
      for (let id of existing.map(obj => obj.id)) {
        push.delete(name, id);
      }
      return db.clear(name);
    });
  },

  remove(name, id) {
    return co(function *() {
      let existing = yield manager.getOne(name, id);
      if (!existing) {
        throw error(404, 'Cannot delete non-existing document.');
      }
      push.delete(name, id);
      return db.get(name).remove({id});
    });
  }
};
