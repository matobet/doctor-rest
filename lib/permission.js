'use strict';

var session = require('./sessions/manager')
  , error = require('./error')
  , _ = require('lodash')
  ;

exports.SECRET = {
  restricts(name) {
    return false;
  },

  check(name, id) {
    return true;
  }
};

exports.getForSessionId = function (sessionId) {
  return session.get(sessionId).then(session => {
    let permissions = session.permissions;
    if (!permissions) {
      throw error(403);
    }
    let isAdmin = permissions === '*';
    return {
      restricts(name) {
        return !isAdmin && !_.isString(permissions[name]);
      },

      check(name, id) {
        return isAdmin || permissions[name] === '*' || (_.isArray(permissions[name]) && _.contains(permissions[name], id));
      },

      getIdWhiteListFor(name) {
        return permissions[name] || [];
      }
    };
  });
};
