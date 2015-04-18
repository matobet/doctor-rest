'use strict';

var request = require('superagent').agent()
  , co = require('co')
  , _ = require('lodash')
  ;

const ROOT_URL = 'http://localhost:8080';
const API_URL = ROOT_URL + '/ovirt-engine/api/';
const EVENTS_URL = API_URL + 'events';
const USER_NAME = 'admin@internal';
const PASSWORD = 'a';

const DOCTOR_URL = 'http://localhost:3000/entities/';

var sessionid = null;

function authenticate(request) {
  if (sessionid) {
    return request.set('JSESSIONID', sessionid);
  } else {
    return request.auth(USER_NAME, PASSWORD);
  }
}

function get(url) {
  return new Promise((resolve, reject) => {
    authenticate(request.get(url))
      .set('Prefer', 'persistent-auth, csrf-protection')
      .set('Session-TTL', '60')
      .accept('application/json; detail=statistics')
      .end((err, res) => {
        if (err) {
          return reject(err);
        }
        sessionid = sessionid || /JSESSIONID=([^;]+);/.exec(res.headers['set-cookie'])[1];
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

function post(name, data) {
  return new Promise((resolve, reject) => {
    request.post(DOCTOR_URL + name).send(data).end((err, res) => {
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

function processStatistics(entity) {
  let statistic = entity.statistics;
  delete entity.statistics;

  for (let stat of statistic.statistic) {
    entity[stat.name.split('.').join('/')] = stat.values.value[0].datum;
  }
}

const SUB_COLLECTION_BLACK_LIST = new Set();
// HACK:
SUB_COLLECTION_BLACK_LIST.add('hostdevices');
SUB_COLLECTION_BLACK_LIST.add('devices');
SUB_COLLECTION_BLACK_LIST.add('storage');
// END HACK
SUB_COLLECTION_BLACK_LIST.add('clusters');

const HANDLERS = {
  vm: processStatistics,
  host: processStatistics,
  nic: processStatistics
};

const BLACK_LIST = new Set();
BLACK_LIST.add('katelloerrata');
BLACK_LIST.add('events'); // we fetch events separately

function setToArray(s) {
  let result = [];
  for (let item of s) {
    result.push(item);
  }
  return result;
}

function gatherLinks(entities) {
  let subCollections = {};
  for (let entity of entities) {
    if (!('link' in entity)) {
      continue;
    }
    for (let link of entity.link.filter(link => !link.rel.endsWith('/search'))) {
      if (SUB_COLLECTION_BLACK_LIST.has(link.rel)) {
        continue;
      }

      if (!(link.rel in subCollections)) {
        subCollections[link.rel] = [];
      }
      subCollections[link.rel].push(link.href);
    }
  }
  return subCollections;
}

function *processSubCollections(entities) {
  let subCollections = gatherLinks(entities);
  for (let subColl of Object.keys(subCollections)) {
    let payload = [];
    let key = null;
    for (let href of subCollections[subColl]) {
      let subData = yield get(ROOT_URL + href);
      let processed = yield processCollection(subData);
      if (processed) {
        key = key || processed.key;
        payload = payload.concat(processed.payload);
      }
    }
    if (key) {
      put(key, payload);
    }
  }
}

function *processCollection(data) {
  let keys = Object.getOwnPropertyNames(data);
  if (keys.length !== 1) {
    return null;
  }
  let key = keys[0];
  if (key in HANDLERS) {
    for (let entity of data[key]) {
      HANDLERS[key](entity);
    }
  }
  yield processSubCollections(data[key]);
  return {key, payload: data[key].map(processEntity)};
}

function updateEntities() {
  console.log(">>> Fetching " + API_URL);
  get(API_URL).then(api => {
    var collections = api.link.map(link => link.rel).filter(rel => !rel.endsWith('/search'));
    collections.filter(collection => !BLACK_LIST.has(collection)).forEach(collection => {
      co(function *() {
        console.log(collection);
        let data = yield get(API_URL + collection);
        let processed = yield processCollection(data);
        if (processed) {
          yield put(processed.key, processed.payload);
        }
      });
    });
  }).catch(err => {
    console.log('Failed fetching ' + API_URL + ': ' + err);
  }).then(() => {
    setTimeout(updateEntities, 5000);
  });
}

var lastEventId = -1;

function updateEvents() {
  let url = lastEventId === -1 ? EVENTS_URL : EVENTS_URL + `?from=${lastEventId}`;
  console.log('>>> Fetching ' + url);
  get(url).then(data => {
    if (!('event' in data)) {
      return;
    }
    data.event.map(event => {
      console.log('processing event ' + event.id);
      let id = parseInt(event.id);
      if (id > lastEventId) {
        lastEventId = id;
      }
      post('event', processEntity(event));
    });
  }).catch(err => {
    console.log('Failed fetching ' + url + ': ' + err);
  }).then(() => {
    setTimeout(updateEvents, 5000);
  });
}

updateEntities();
updateEvents();
