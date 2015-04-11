'use strict';

const MONGO_HOST = process.env.MONGO_HOST || 'localhost';
const MONGO_MAIN_DB = process.env.MONGO_MAIN_DB || 'doctor';
const _PORT_OFFSET = +(process.env.PORT_OFFSET || 0);
const API_PORT = (process.env.API_PORT || 3000) + _PORT_OFFSET;
const MQTT_PORT = (process.env.MQTT_PORT || 1883) + _PORT_OFFSET;
const SECRET = process.env.SECRET;

module.exports = {
  MONGO_HOST,
  MONGO_MAIN_DB,
  API_PORT,
  MQTT_PORT,
  SECRET
};
