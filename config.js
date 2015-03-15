'use strict';

const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
const MONGO_MAIN_DB = process.env.MONGO_MAIN_DB || 'doctor';
const MONGO_MQTT_DB = process.env.MONGO_MQTT_DB || 'mqtt';
const _PORT_OFFSET = +(process.env.PORT_OFFSET || 0);
const API_PORT = (process.env.API_PORT || 3000) + _PORT_OFFSET;
const MQTT_PORT = (process.env.MQTT_PORT || 1883) + _PORT_OFFSET;

module.exports = {
  MONGO_HOST: MONGO_HOST,
  MONGO_MAIN_DB: MONGO_MAIN_DB,
  MONGO_MQTT_DB: MONGO_MQTT_DB,
  API_PORT: API_PORT,
  MQTT_PORT: MQTT_PORT
};
