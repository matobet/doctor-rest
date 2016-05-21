'use strict'

var _ = require('lodash')

function byId (arr) {
  const map = {}
  for (let obj of arr) {
    map[obj.id] = obj
  }
  return map
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
  switchStringArrayObject
}
