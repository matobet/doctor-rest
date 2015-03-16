'use strict';

var manager = require('./manager')
  ;


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
