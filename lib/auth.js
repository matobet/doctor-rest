'use strict'

var co = require('co')

function loadAuthPlugin (pluginName) {
  try {
    return require(`doctor-rest-auth-${pluginName}`)
  } catch (e) {
    // ignore import errors
  }
}

module.exports = function (headers) {
  return co(function *() {
    if (!headers.auth) {
      return
    }

    let pluginName = headers.auth.toLowerCase()
    let authPlugin = loadAuthPlugin(pluginName)

    if (!authPlugin) {
      return
    }

    return yield authPlugin(headers)
  })
}
