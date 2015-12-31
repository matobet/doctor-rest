'use strict'

var util = require('../util')
var _ = require('lodash')

function objectDiff (original, updated) {
  const diff = {
    fields: []
  }
  for (let key of Object.keys(updated)) {
    if (!original.hasOwnProperty(key) || !_.isEqual(original[key], updated[key])) {
      diff.fields.push(key)
    }
  }
  return diff
}

function isEmpty (diff) {
  return diff.fields.length === 0
}

function arrayDiff (original, updated) {
  const diffs = {
    created: [],
    updated: [],
    deleted: []
  }
  const originalById = util.byId(original)
  for (let u of updated) {
    if (u.id in originalById) {
      const diff = objectDiff(originalById[u.id], u)
      if (!isEmpty(diff)) {
        diff.id = u.id
        diffs.updated.push(diff)
      }
    } else {
      diffs.created.push(u.id)
    }
  }
  const updatedById = util.byId(updated)
  for (let o of original) {
    if (!(o.id in updatedById)) {
      diffs.deleted.push(o.id)
    }
  }
  return diffs
}

module.exports = {
  object: objectDiff,
  array: arrayDiff
}
