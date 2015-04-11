'use strict';

const SESSION_COLL = '_session';

var co = require('co')
  , error = require('../error')
  , db = require('../db')
  , check = require('../check')
  , coll = db.get(SESSION_COLL)
  ;

const manager = module.exports = {
  list() {
    return coll.find({}, db.NO_MONGO_ID);
  },

  create(session) {
    check.payload(session);
    check.id(session);

    return coll.insert(session);
  },

  get(id) {
    return coll.findOne({id}, db.NO_MONGO_ID);
  },

  update(id, data) {
    check.payload(data);
    if ('id' in data && data.id !== id) {
      throw error(400, "Session id cannot be patched.");
    }
    return co(function *() {
      let existing = yield coll.findOne({id}, db.ID_ONLY);
      if (!existing) {
        throw error(404, "Cannot patch non-existing session.");
      }
      yield coll.update({id}, {$set: data});
    });
  },

  replaceAll(sessions) {
    return co(function *() {
      check.array(sessions);
      sessions.map(check.id);

      yield db.clear(SESSION_COLL);
      yield coll.insert(sessions);
    });
  },

  replace(id, session) {
    check.payload(session);
    check.id(session);
    if (id !== session.id) {
      throw error(400, 'Session ID must match last segment of URL.');
    }
    return co(function *() {
      let existing = yield coll.findOne({id}, db.ID_ONLY);
      console.log(existing);
      if (existing) {
        coll.update({id}, session);
        return false;
      } else {
        coll.insert(session);
        return true;
      }
    });
  },

  removeAll() {
    return db.clear(SESSION_COLL);
  },

  remove(id) {
    return coll.remove({id});
  }
};
