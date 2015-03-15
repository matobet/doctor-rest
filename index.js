'use strict';

var koa = require('koa')
  , logger = require('koa-logger')
  , route = require('koa-route')
  , bodyParser = require('koa-bodyparser')

  , entities = require('./entities')
  , mqtt = require('./mqtt')
  ;

var app = koa();

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

app.listen(3000, () => {
  console.log("* DOCumenT ORiented REST Api started ...");
});

mqtt.init(() => {
  console.log("* MQTT Broker listening on port 1883 ...");
  mqtt.publish({ topic: 'foo', payload: "foooooo"});
});
