'use strict'

var mosca = require('mosca')
var config = require('./config')

var server

exports.init = function init (httpServer, ready) {
  server = new mosca.Server({
    port: config.MQTT_PORT,
    persistence: mosca.persistence.Memory()
  })

  // attach to http server for websocket support
  server.attachHttpServer(httpServer)

  process.nextTick(ready)
}

exports.publish = function publish (topic, payload) {
  server.publish({topic, payload})
  console.log('MQTT broadcast on topic "' + topic + '": ' + payload)
}
