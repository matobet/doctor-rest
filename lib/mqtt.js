'use strict';

var mosca = require('mosca')
  , config = require('./config')
  , mqtt = require('mqtt')
  ;

var server, client;

exports.init = function init(httpServer, ready) {
  server = new mosca.Server({
    port: config.MQTT_PORT,
    persistence: mosca.persistence.Memory()
  });

  // attach to http server for websocket support
  server.attachHttpServer(httpServer);

  // create a client to our newly created broker since the broker alone
  // does not allow us to publish messages directly
  client = mqtt.connect(`mqtt://localhost:${config.MQTT_PORT}`);
  if (typeof ready == 'function') {
    client.on('connect', ready);
  }
};

exports.publish = function publish(topic, message) {
  client.publish(topic, message);
  console.log('MQTT broadcast on topic "' + topic + '": ' + message);
};

