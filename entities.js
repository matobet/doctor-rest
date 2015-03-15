'use strict';

var co = require('co')
  , db = require('./db')
  , mqtt = require('./mqtt')
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

var manager = {
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
      return db.get(name).update({id}, {$set: data});
    });
  },

  replaceCollection(name, entities) {
    if (!Array.isArray(entities)) {
      throw error(400, "Request must contain an array.")
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

exports.getCollection = function *getCollection(name) {
  this.body = yield manager.getCollection(name);
};


exports.get = function *get(name, id) {
  this.body = yield manager.getOne(name, id);
  if (!this.body) {
    this.status = 404;
  }
};


exports.replace = function *replace(name, id) {
  let created = yield manager.replace(name, id, this.request.body);
  this.status = created ? 201 : 200;
};


exports.replaceCollection = function *replaceCollection(name) {
  let created = yield manager.replaceCollection(name, this.request.body);
  this.status = created ? 201 : 200;
};


exports.update = function *update(name, id) {
  yield manager.patch(name, id, this.request.body);
  this.status = 200;
};


exports.create = function *create(name) {
  yield manager.create(name, this.request.body);
  this.status = 201;
};


exports.removeCollection = function *removeCollection(name) {
  yield manager.removeCollection(name);
  this.status = 204;
};


exports.remove = function *remove(name, id) {
  yield manager.remove(name, id);
  this.status = 204;
};
