'use strict';

var co = require('co')
  ;

module.exports = function (headers) {
  return co(function *() {
    if (!headers.auth) {
      return;
    }

    console.dir(headers);
    let pluginName = headers.auth.toLowerCase();
    let authPlugin;

    try {
      authPlugin = require(`doctor-rest-auth-${pluginName}`);
    } catch (e) {
      // ignore import errors
    }

    if (!authPlugin) {
      return;
    }

    return yield authPlugin(headers);
  });
};
