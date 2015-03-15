'use strict';

var db = require('monk')('localhost/doctor')
  , co = require('co')
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
      throw error(400, "Documend id cannot be patched.");
    }
    return db.get(name).update({id}, { $set: data });
  },

  replaceCollection(name, entities) {

  },

  replace(name, id, entity) {
    checkId(entity);
    if (id !== entity.id) {
      throw error(400, "Document id must match last segment of document URL.");
    }
    return db.get(name).update({id}, entity);
  },

  removeCollection(name) {
    return db.get(name).drop();
  },

  remove(name, id) {
    return db.get(name).remove({id});
  }
};

const NO_MONGO_ID = {fields: {_id: 0}};

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
  this.body = yield manager.replace(name, id, this.request.body);
  this.status = 200;
};


exports.replaceCollection = function *replaceCollection(name) {
  yield manager.replaceCollection(name, this.request.body);
  this.status = 200;
};


exports.update = function *update(name, id) {
  yield manager.patch(name, id, this.request.body);
  this.status = 200;
};


exports.create = function *create(name) {
  console.log(this.request.body);
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
