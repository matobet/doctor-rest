'use strict';

var mosca = require('mosca');

var server;

exports.init = function init(ready) {
  server = new mosca.Server({
    port: 1883,
    backend: {
      type: 'mongo',
      url: 'mongodb://localhost/mqtt',
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
