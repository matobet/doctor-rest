'use strict';

var co = require('co')
  , db = require('../db')
  , mqtt = require('../mqtt')
  ;

function error(code, msg) {
  let err = new Error(msg);
  err.status = code;
  err.expose = true;
  return err;
}

function checkId(entity) {
  if (!('id' in entity)) {
    throw error(400, "Document needs to contain the 'id' attribute.");
  }
}

const NO_MONGO_ID = {fields: {_id: 0}};

function pushUpdate(name, id, diff) {
  const keys = Object.keys(diff).filter(key => key != 'id');
  if (keys.length) {
    mqtt.publish(`${name}/${id}`, keys.toString());
  }
}

function objectDiff(original, updated) {
  const diff = {};
  for (let key of Object.keys(updated)) {
    if (!original.hasOwnProperty(key) || original[key] !== updated[key]) {
      diff[key] = updated[key];
    }
  }
  return diff;
}

function arrayDiff(original, updated) {
  const diffs = [];
  const originals = {};
  for (let o of original) {
    originals[o.id] = o;
  }
  for (let u of updated) {
    if (u.id in originals) {
      const diff = objectDiff(originals[u.id], u);
      diff.id = u.id;
      diffs.push(diff);
    } else {
      diffs.push(u);
    }
  }
  return diffs;
}

const manager = module.exports = {
  getCollection(name) {
    return db.get(name).find({}, NO_MONGO_ID);
  },

  getOne(name, id) {
    return db.get(name).findOne({id}, NO_MONGO_ID);
  },

  create(name, entity) {
    checkId(entity);
    return co(function *() {
      let existing = yield manager.getOne(name, entity.id);
      if (existing) {
        return manager.replace(name, entity.id, entity);
      } else {
        pushUpdate(name, entity.id, entity);
        return db.get(name).insert(entity);
      }
    });
  },

  patch(name, id, data) {
    if ('id' in data && data.id !== id) {
      throw error(400, "Document id cannot be patched.");
    }
    return co(function *() {
      let existing = yield manager.getOne(name, id);
      if (!existing) {
        throw error(404, "Cannot patch non-existing document.");
      }
      pushUpdate(name, id, objectDiff(existing, data));
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
      var diffs = arrayDiff(existing, entities);
      diffs.forEach(diff => pushUpdate(name, diff.id, diff));
      yield db.get(name).insert(entities);
      return created;
    });
  },

  replace(name, id, entity) {
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
      pushUpdate(name, id, objectDiff(existing, entity));
      yield db.get(name).update({id}, entity);
      return false;
    });
  },

  removeCollection(name) {
    return db.clear(name);
  },

  remove(name, id) {
    return co(function *() {
      let existing = yield manager.getOne(name, id);
      if (!existing) {
        throw error(404, 'Cannot delete non-existing document.');
      }
      return db.get(name).remove({id});
    });
  }
};
