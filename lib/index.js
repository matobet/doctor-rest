'use strict'

var http = require('http')
var koa = require('koa')
var logger = require('koa-logger')
var bodyParser = require('koa-bodyparser')
var compress = require('koa-compress')
var cluster = require('cluster')

var auth = require('./auth')
var config = require('./config')
var entities = require('./entities/api')
var mqtt = require('./mqtt')

// display only once, regardless of clustering
if (cluster.isMaster) {
  console.dir(config)

  if (!config.SECRET) {
    console.warn('! No `SECRET` specified! Running in unsecured mode ...')
  }
}

if (config.CLUSTERED && cluster.isMaster) {
  let numCpus = require('os').cpus().length

  for (let i = 0; i < numCpus; i++) {
    cluster.fork()
  }
} else {
  const app = koa()

  app.use(logger())

  app.use(compress({
    threshold: 1024
  }))

  app.use(function *(next) {
    this.isPrivilegedRequest = this.request.method !== 'GET'
    this.hasSecretPrivilege = !config.SECRET || config.SECRET === this.request.headers.secret
    if (this.isPrivilegedRequest && !this.hasSecretPrivilege) {
      this.throw(401)
    } else {
      yield next
    }
  })

  app.use(function *(next) {
    if (!this.hasSecretPrivilege) {
      this.user = yield auth(this.request.headers)
      if (!this.user) {
        this.throw(401)
      }
    }

    yield next
  })

  app.use(bodyParser())

  app.use(entities.routes())

  let server = module.exports = http.createServer(app.callback())

  mqtt.init(server, () => {
    console.log(`* MQTT Broker listening on port ${config.MQTT_PORT} ...`)
  })

  server.listen(config.API_PORT, () => {
    console.log(`* DOCumenT ORiented REST Api started on port ${config.API_PORT} ...`)
  })
}
