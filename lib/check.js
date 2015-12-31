'use strict'

var error = require('./error')

exports.id = function (entity) {
  if (!('id' in entity)) {
    throw error(400, "Document needs to contain the 'id' attribute.")
  }
  // ensure persisted id is String
  entity.id = entity.id.toString()
}

exports.payload = function (data) {
  if (!data) {
    throw error(400, 'Request body cannot be empty.')
  }
}

exports.array = function (data) {
  if (!Array.isArray(data)) {
    throw error(400, 'Request must contain an array.')
  }
}
