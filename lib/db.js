'use strict';

var config = require('./config')
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

module.exports.NO_MONGO_ID = {fields: {_id: 0}};
module.exports.ID_ONLY = {fields: {id: 1, _id: 0}};
