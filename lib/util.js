'use strict'

var _ = require('lodash')

function byId (arr) {
  const map = {}
  for (let obj of arr) {
    map[obj.id] = obj
  }
  return map
}

function setToArray (s) {
  let result = []
  for (let item of s) {
    result.push(item)
  }
  return result
}

function arrayToSet (arr) {
  let result = new Set()
  for (let item of arr) {
    result.add(item)
  }
  return result
}

function keyedPromise (obj, createPromise) {
  return _.reduce(obj, (promises, val, key) => {
    promises[key] = createPromise(key, val)
    return promises
  }, {})
}

function isEmptyObject (obj) {
  return Object.getOwnPropertyNames(obj).length === 0
}

function switchStringArrayObject (obj, funs) {
  if (_.isString(obj)) {
    return funs.string()
  }
  if (_.isArray(obj)) {
    return funs.array()
  }
  if (_.isObject(obj)) {
    return funs.object()
  }
  throw new Error('Not String/Array/Object')
}

module.exports = {
  byId,
  setToArray,
  arrayToSet,
  keyedPromise,
  isEmptyObject,
  switchStringArrayObject
}
