'use strict';

var _ = require('lodash')
  ;

function byId(arr) {
  const map = {};
  for (let obj of arr) {
    map[obj.id] = obj;
  }
  return map;
}

function setToArray(s) {
  let result = [];
  for (let item of s) {
    result.push(item);
  }
  return result;
}

function keyedPromise(obj, createPromise) {
  return _.reduce(obj, (promises, val, key) => {
    promises[key] = createPromise(key, val);
    return promises;
  }, {});
}

module.exports = {
  byId,
  setToArray,
  keyedPromise
};
