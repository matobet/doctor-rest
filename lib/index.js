'use strict';

var koa = require('koa')
  , logger = require('koa-logger')
  , route = require('koa-route')
  , bodyParser = require('koa-bodyparser')

  , config = require('./config')
  , entities = require('./entities/api')
  , mqtt = require('./mqtt')
  ;

const app = module.exports = koa();

app.use(logger());
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

app.listen(config.API_PORT, () => {
  console.log(`* DOCumenT ORiented REST Api started on port ${config.API_PORT} ...`);
});

mqtt.init(() => {
  console.log(`* MQTT Broker listening on port ${config.MQTT_PORT} ...`);
});
