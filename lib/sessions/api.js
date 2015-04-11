'use strict';

var manager = require('./manager')
  ;

exports.list = function* () {
  this.body = yield manager.list();
};

exports.replaceAll = function *() {
  yield manager.replaceAll(this.request.body);
  this.status = 200;
};

exports.create = function *() {
  yield manager.create(this.request.body);
  this.status = 201;
};

exports.get = function *(id) {
  this.body = yield manager.get(id);
  if (!this.body) {
    this.status = 404;
  }
};

exports.replace = function *(id) {
  let created = yield manager.replace(id, this.request.body);
  this.status = created ? 201 : 200;
};

exports.update = function *(id) {
  yield manager.update(id, this.request.body);
};

exports.removeAll = function *() {
  yield manager.removeAll();
  this.status = 204;
};

exports.remove = function *(id) {
  yield manager.remove(id);
  this.status = 204;
};
