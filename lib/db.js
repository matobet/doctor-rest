'use strict';

var config = require('./config')
  , _ = require('lodash')
  , mongo = require('monk')(`${config.MONGO_HOST}/${config.MONGO_MAIN_DB}`)
  ;

module.exports = mongo;

function safeDrop(name) {
  const p = mongo.get(name).drop();
  return p.then(null, err => {
    p.fulfill();
  });
}

module.exports.clear = function() {
  const collectionsToDrop = [].slice.call(arguments);
  return Promise.all(collectionsToDrop.map(safeDrop));
};

module.exports.queryFields = function (fields) {
  let mongoQuery = _.cloneDeep(module.exports.NO_MONGO_ID);
  if (fields) {
    for (let field of fields) {
      mongoQuery.fields[field] = 1;
    }
  }
  return mongoQuery;
};

module.exports.filterLink = function (name, id) {
  let filter = {};
  filter[name] = id;
  return filter;
};

// cache to avoid expensive redundant calls to index same fields
var indexCache = {};

module.exports.ensureIndex = function (name, field) {
  if (!indexCache[name]) {
    indexCache[name] = new Set();
  }
  if (!indexCache[name].has(field)) {
    indexCache[name].add(field);
    mongo.get(name).ensureIndex({[field]: 1});
  }
};

module.exports.NO_MONGO_ID = {fields: {_id: 0}};
module.exports.ID_ONLY = {fields: {id: 1, _id: 0}};
