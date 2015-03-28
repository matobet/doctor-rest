'use strict';

var mqtt = require('../mqtt')
  ;

function pushCreate(name, id) {
  mqtt.publish(`${name}/${id}`, '+');
}

function pushDelete(name, id) {
  mqtt.publish(`${name}/${id}`, '-');
}

function pushDeltaUpdate(name, id, diff) {
  const fields = diff.fields.concat(diff.links.map(link => '@' + link));
  if (fields.length) {
    mqtt.publish(`${name}/${id}`, fields.toString());
  }
}

module.exports = {
  create: pushCreate,
  delete: pushDelete,
  deltaUpdate: pushDeltaUpdate
};
