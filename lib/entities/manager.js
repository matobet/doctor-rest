'use strict';

var co = require('co')
  , db = require('../db')
  , mqtt = require('../mqtt')
  , diff = require('./diff')
  ;

function error(code, msg) {
  let err = new Error(msg);
  err.status = code;
  err.expose = true;
  return err;
}

function checkPayload(data) {
  if (!data) {
    throw error(400, "Request body cannot be empty.");
  }
}

function checkId(entity) {
  if (!('id' in entity)) {
    throw error(400, "Document needs to contain the 'id' attribute.");
  }
}

const NO_MONGO_ID = {fields: {_id: 0}};
const ID_ONLY = {fields: {id: 1, _id: 0}};

function pushCreate(name, id) {
  mqtt.publish(`${name}/${id}`, '+');
}

function pushDelete(name, id) {
  mqtt.publish(`${name}/${id}`, '-');
}

function pushDeltaUpdate(name, id, diff) {
  const fields = diff.fields.concat(diff.links.map(link => '@' + link));
  if (fields.length) {
    mqtt.publish(`${name}/${id}`, fields.toString());
  }
}

const manager = module.exports = {
  getCollection(name) {
    return db.get(name).find({}, NO_MONGO_ID);
  },

  getOne(name, id) {
    return db.get(name).findOne({id}, NO_MONGO_ID);
  },

  create(name, entity) {
    checkPayload(entity);
    checkId(entity);
    return co(function *() {
      let existing = yield manager.getOne(name, entity.id);
      if (existing) {
        return manager.replace(name, entity.id, entity);
      } else {
        pushCreate(name, entity.id);
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
      pushDeltaUpdate(name, id, diff.object(existing, data));
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
      diffs.created.forEach(id => pushCreate(name, id));
      diffs.updated.forEach(diff => pushDeltaUpdate(name, diff.id, diff));
      diffs.deleted.forEach(id => pushDelete(name, id));
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
      pushDeltaUpdate(name, id, diff.object(existing, entity));
      yield db.get(name).update({id}, entity);
      return false;
    });
  },

  removeCollection(name) {
    return co(function *() {
      const existing = yield db.get(name).find({}, ID_ONLY);
      for (let id of existing.map(obj => obj.id)) {
        pushDelete(name, id);
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
      pushDelete(name, id);
      return db.get(name).remove({id});
    });
  }
};
