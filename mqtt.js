'use strict';

var mosca = require('mosca')
  , config = require('./config')
  ;

var server;

exports.init = function init(ready) {
  server = new mosca.Server({
    port: config.MQTT_PORT,
    backend: {
      type: 'mongo',
      url: `mongodb://${config.MONGO_HOST}/${config.MONGO_MQTT_DB}`,
      pubsubCollection: 'ascoltatori',
      mongo: {}
    }
  });
  if (typeof ready == 'function') {
    server.on('ready', ready);
  }
};

exports.publish = function publish(message) {
  message.qos = message.qos || 2;
  server.publish(message);
};
