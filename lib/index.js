'use strict';

var http = require('http')
  , koa = require('koa')
  , logger = require('koa-logger')
  , route = require('koa-route')
  , bodyParser = require('koa-bodyparser')
  , compress = require('koa-compress')

  , auth = require('./auth')
  , config = require('./config')
  , entities = require('./entities/api')
  , mqtt = require('./mqtt')
  ;

const app = module.exports = koa();

app.use(logger());

app.use(compress({
  threshold: 1024
}));

app.use(function *(next) {
  this.isPrivilegedRequest = this.request.method !== 'GET';
  this.hasSecretPrivilege = !config.SECRET || config.SECRET === this.request.headers.secret;
  if (this.isPrivilegedRequest && !this.hasSecretPrivilege) {
    this.throw(401);
  } else {
    yield next;
  }
});

app.use(function *(next) {
  if (!this.hasSecretPrivilege) {
    this.user = yield auth(this.request.headers);
    if (!this.user) {
      this.throw(401);
    }
  }

  yield next;
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

console.dir(config);

if (!config.SECRET) {
  console.warn('No `SECRET` specified! Running in unsecured mode ...');
}

var server = http.createServer(app.callback());

mqtt.init(server, () => {
  console.log(`* MQTT Broker listening on port ${config.MQTT_PORT} ...`);
});

server.listen(config.API_PORT, () => {
  console.log(`* DOCumenT ORiented REST Api started on port ${config.API_PORT} ...`);
});
