'use strict';

var app = require('../../lib/index')
  , request = require('co-supertest').agent(app.listen())
  ;

function get(url, status) {
  return request.get(url).expect(status || 200).type('json').end();
}

function post(url, payload, status) {
  return request.post(url).send(payload).expect(status || 201).end();
}

function patch(url, payload, status) {
  return request.patch(url).send(payload).expect(status || 200).end();
}

function put(url, payload, status) {
  return request.put(url).send(payload).expect(status || 200).end();
}

function remove(url, status) {
  return request.delete(url).expect(status || 204).end();
}

module.exports = {
  get: get,
  post: post,
  patch: patch,
  put: put,
  remove: remove
};
