'use strict';

var request = require('superagent')
  , co = require('co')
  ;

//const ROOT_URL = 'http://localhost:8080/ovirt-engine/api/';
const ROOT_URL = 'http://192.168.0.108/ovirt-engine/api/';
const USER_NAME = 'admin@internal';
const PASSWORD = 'a';

const DOCTOR_URL = 'http://localhost:3000/entities/';

function get(url) {
  return new Promise((resolve, reject) => {
    request.get(url).auth(USER_NAME, PASSWORD).accept('application/json; detail=statistics').end((err, res) => {
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
    //console.log('Processing: ' + path);
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

const COLLECTIONS = ['vm', 'cluster', 'template', 'data_center', 'host', 'user', 'domain', 'permission', 'role', 'network'];

const API_ALIASES = {
  data_center: 'datacenter'
};

function getCollectionUrl(collection) {
  let path = collection in API_ALIASES ? API_ALIASES[collection] : collection;
  return ROOT_URL + path + "s/";
}

function processStatistics(entity) {
  let statistic = entity.statistics;
  delete entity.statistics;

  for (let stat of statistic.statistic) {
    entity[stat.name.split('.').join('/')] = stat.values.value[0].datum;
  }
}

const HANDLERS = {
  vm: processStatistics,
  host: processStatistics
};

COLLECTIONS.forEach(collection => {
  co(function *() {
    let data = yield get(getCollectionUrl(collection));
    if (collection in HANDLERS) {
      for (let entity of data[collection]) {
        HANDLERS[collection](entity);
      }
    }
    let processed = data[collection].map(processEntity);
    console.dir(processed);
    yield put(collection, processed);
  }).catch(err => {
    console.log(err);
  });
});
