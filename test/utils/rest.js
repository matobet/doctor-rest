'use strict';

var app = require('../../lib/index')
  , config = require('../../lib/config')
  , _ = require('lodash')
  , request = require('co-supertest').agent(app.listen())
  ;

function get(options) {
  let url = options.url;
  let status = options.status || 200;
  let secret = options.secret || config.SECRET;
  let payload = options.payload;
  return request.get(url).set('secret', secret).send(payload).expect(status).type('json').end();
}

function post(options) {
  let url = options.url;
  let status = options.status || 201;
  let secret = options.secret || config.SECRET;
  let payload = options.payload;
  return request.post(url).set('secret', secret).send(payload).expect(status).end();
}

function patch(options) {
  let url = options.url;
  let status = options.status || 200;
  let secret = options.secret || config.SECRET;
  let payload = options.payload;
  return request.patch(url).set('secret', secret).send(payload).expect(status).end();
}

function put(options) {
  let url = options.url;
  let status = options.status || 200;
  let secret = options.secret || config.SECRET;
  let payload = options.payload;
  return request.put(url).set('secret', secret).send(payload).expect(status).end();
}

function remove(options) {
  let url = options.url;
  let status = options.status || 204;
  let secret = options.secret || config.SECRET;
  return request.delete(url).set('secret', secret).expect(status).end();
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
