'use strict';

var app = require('../../lib/index')
  , _ = require('lodash')
  , request = require('co-supertest').agent(app.listen())
  ;

function get(options) {
  let url = options.url;
  let status = options.status || 200;
  let payload = options.payload;
  return request.get(url).send(payload).expect(status).type('json').end();
}

function post(options) {
  let url = options.url;
  let status = options.status || 201;
  let payload = options.payload;
  return request.post(url).send(payload).expect(status).end();
}

function patch(options) {
  let url = options.url;
  let status = options.status || 200;
  let payload = options.payload;
  return request.patch(url).send(payload).expect(status).end();
}

function put(options) {
  let url = options.url;
  let status = options.status || 200;
  let payload = options.payload;
  return request.put(url).send(payload).expect(status).end();
}

function remove(url, status) {
  return request.delete(url).expect(status || 204).end();
}

function *setup(entities) {
  for (let entity of Object.keys(entities)) {
    if (_.isArray(entities[entity])) {
      yield put({url: `/entities/${entity}`, payload: entities[entity], status: 201});
    } else {
      yield post({url: `/entities/${entity}`, payload: entities[entity]});
    }
  }
}

module.exports = {
  get: get,
  post,
  patch,
  put,
  remove,
  setup
};
