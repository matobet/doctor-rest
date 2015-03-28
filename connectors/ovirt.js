'use strict';

var request = require('superagent')
  , co = require('co')
  ;

const ROOT_URL = 'http://localhost:8080/ovirt-engine/api/';
const USER_NAME = 'admin@internal';
const PASSWORD = 'a';

const DOCTOR_URL = 'http://localhost:3000/entities/';

function get(url) {
  return new Promise((resolve, reject) => {
    request.get(url).auth(USER_NAME, PASSWORD).accept('application/json').end((err, res) => {
      if (err) {
        return reject(err);
      }
      resolve(res.body);
    });
  });
}

function put(name, data) {
  return new Promise((resolve, reject) => {
    request.put(DOCTOR_URL + name).send(data).end((err, res) => {
      if (err) {
        return reject(err);
      }
      resolve(res.body);
    });
  });
}

const IGNORE = ['actions', 'link', 'href'];

function isLink(obj) {
  return typeof obj === 'object' && obj.hasOwnProperty('href');
}

function flatten(root, prefix, obj) {
  for (let key of Object.keys(obj)) {
    const path = `${prefix}/${key}`;
    console.log('Processing: ' + path);
    if (typeof obj[key] === 'object') {
      flatten(root, path, obj[key]);
    } else {
      root[path] = obj[key];
    }
  }
}

function processEntity(data) {
  for (let property of IGNORE) {
    delete data[property];
  }
  let result = {}, links = {};

  for (let property of Object.keys(data)) {
    if (isLink(data[property])) {
      links[property] = data[property].id;
    } else if (typeof data[property] === 'object') {
      flatten(result, property, data[property]);
    } else {
      result[property] = data[property];
    }
  }

  if (Object.getOwnPropertyNames(links).length > 0) {
    result._links = links;
  }

  return result;
}

const COLLECTIONS = ['vm', 'cluster', 'template', 'data_center', 'host', 'user', 'domain', 'permission', 'role'];

const API_ALIASES = {
  data_center: 'datacenter'
};

COLLECTIONS.forEach(collection => {
  co(function *() {
    let path = collection in API_ALIASES ? API_ALIASES[collection] : collection;
    let data = yield get(ROOT_URL + path + "s");
    let processed = data[collection].map(processEntity);
    console.dir(processed);
    yield put(collection, processed);
  });
});
