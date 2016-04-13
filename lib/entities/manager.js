'use strict'

var co = require('co')
var _ = require('lodash')
var db = require('../db')
var check = require('../check')
var Query = require('../query')
var util = require('../util')
var error = require('../error')
var diff = require('./diff')
var push = require('./push')

function checkUniqueIds (entities) {
  let ids = new Set()
  for (let entity of entities) {
    if (ids.has(entity.id)) {
      throw error(400, 'Duplicate document id: ' + entity.id)
    }
    ids.add(entity.id)
  }
}

const manager = module.exports = {
  getCollection (name, query, user) {
    return Query.many(name, query, user)
  },

  getOne (name, id, query, user) {
    return Query.one(name, id, query, user)
  },

  create (name, entity) {
    check.payload(entity)
    check.id(entity)
    return co(function * () {
      let exists = yield manager.checkExistsOne(name, entity.id)
      if (exists) {
        return yield manager.replace(name, entity.id, entity)
      } else {
        db.ensureIndex(name, 'id')
        push.create(name, entity.id)
        return yield db.get(name).insert(entity)
      }
    })
  },

  patch (name, id, data) {
    check.payload(data)
    if ('id' in data && data.id !== id) {
      throw error(400, 'Document id cannot be patched.')
    }
    return co(function * () {
      if (util.isEmptyObject(data)) {
        return
      }
      let existing = yield manager.getOne(name, id)
      if (!existing) {
        throw error(404, 'Cannot patch non-existing document.')
      }
      push.deltaUpdate(name, id, diff.object(existing, data))

      let removedFields = {}
      for (let field of Object.keys(data)) {
        if (_.isNull(data[field])) {
          removedFields[field] = '' // mongo needs some value for the key (ignored)
          delete data[field] // remove from update data, so we wouldn't try to set to null
        }
      }

      let query = {}
      if (!util.isEmptyObject(data)) {
        query.$set = data
      }
      if (!util.isEmptyObject(removedFields)) {
        query.$unset = removedFields
      }
      return yield db.get(name).update({id}, query)
    })
  },

  replaceCollection (name, entities) {
    check.array(entities)
    entities.map(check.id)

    checkUniqueIds(entities)

    return co(function * () {
      if (_.isEmpty(entities)) {
        yield manager.removeCollection(name)
        return false
      }
      let existing = yield manager.getCollection(name)
      let created = existing.length === 0
      if (created) {
        db.ensureIndex(name, 'id')
      } else {
        yield db.clear(name)
        created = false
      }
      var diffs = diff.array(existing, entities)
      diffs.created.forEach((id) => push.create(name, id))
      diffs.updated.forEach((diff) => push.deltaUpdate(name, diff.id, diff))
      diffs.deleted.forEach((id) => push.delete(name, id))
      yield db.get(name).insert(entities)
      return created
    })
  },

  replace (name, id, entity) {
    check.payload(entity)
    check.id(entity)
    if (id !== entity.id) {
      throw error(400, 'Document id must match last segment of document URL.')
    }
    return co(function * () {
      let existing = yield manager.getOne(name, id)
      if (!existing) {
        yield manager.create(name, entity)
        return true
      }
      push.deltaUpdate(name, id, diff.object(existing, entity))
      yield db.get(name).update({id}, entity)
      return false
    })
  },

  removeCollection (name) {
    return co(function * () {
      const existing = yield db.get(name).find({}, db.ID_ONLY)
      for (let id of existing.map((obj) => obj.id)) {
        push.delete(name, id)
      }
      return yield db.clear(name)
    })
  },

  remove (name, id) {
    return co(function * () {
      let exists = yield manager.checkExistsOne(name, id)
      if (!exists) {
        throw error(404, 'Cannot delete non-existing document.')
      }
      push.delete(name, id)
      return yield db.get(name).remove({id})
    })
  },

  checkExistsOne (name, id) {
    return db.get(name).findOne({id}, db.ID_ONLY)
  }
}
