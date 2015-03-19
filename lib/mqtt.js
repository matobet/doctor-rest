'use strict';

var mosca = require('mosca')
  , config = require('./config')
  , mqtt = require('mqtt')
  ;

var server, client;

exports.init = function init(ready) {
  server = new mosca.Server({
    port: config.MQTT_PORT,
    persistence: mosca.persistence.Memory()
  });
  client = mqtt.connect(`mqtt://localhost:${config.MQTT_PORT}`);
  if (typeof ready == 'function') {
    client.on('connect', ready);
  }
};

exports.publish = function publish(topic, message) {
  client.publish(topic, message);
  console.log('MQTT broadcast on topic "' + topic + '": ' + message);
};

