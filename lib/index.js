'use strict';

var koa = require('koa')
  , logger = require('koa-logger')
  , route = require('koa-route')
  , bodyParser = require('koa-bodyparser')

  , config = require('./config')
  , entities = require('./entities/api')
  , sessions = require('./sessions/api')
  , mqtt = require('./mqtt')
  ;

const app = module.exports = koa();

app.use(logger());

app.use(function *(next) {
  this.isPrivilegedRequest = this.request.method !== 'GET' || this.request.path.startsWith('/sessions');
  if (this.isPrivilegedRequest && config.SECRET && config.SECRET !== this.request.headers.secret) {
    this.throw(401);
  } else {
    yield next;
  }
});

app.use(bodyParser());

app.use(route.get('/entities/:name', entities.getCollection));
app.use(route.put('/entities/:name', entities.replaceCollection));
app.use(route.delete('/entities/:name', entities.removeCollection));

app.use(route.post('/entities/:name', entities.create));
app.use(route.get('/entities/:name/:id', entities.get));
app.use(route.put('/entities/:name/:id', entities.replace));
app.use(route.patch('/entities/:name/:id', entities.update));
app.use(route.delete('/entities/:name/:id', entities.remove));

app.use(route.get('/sessions', sessions.list));
app.use(route.put('/sessions', sessions.replaceAll));
app.use(route.delete('/sessions', sessions.removeAll));

app.use(route.post('/sessions', sessions.create));
app.use(route.get('/sessions/:id', sessions.get));
app.use(route.put('/sessions/:id', sessions.replace));
app.use(route.patch('/sessions/:id', sessions.update));
app.use(route.delete('/sessions/:id', sessions.remove));

console.dir(config);

if (!config.SECRET) {
  console.warn('No `SECRET` specified! Running in unsecured mode ...');
}

app.listen(config.API_PORT, () => {
  console.log(`* DOCumenT ORiented REST Api started on port ${config.API_PORT} ...`);
});

mqtt.init(() => {
  console.log(`* MQTT Broker listening on port ${config.MQTT_PORT} ...`);
});
