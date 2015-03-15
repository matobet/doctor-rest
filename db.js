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
