'use strict'

var manager = require('./manager')
var error = require('../error')
var Router = require('koa-router')

function getQuery (ctx) {
  try {
    return ctx.request.query.q ? JSON.parse(ctx.request.query.q) : ctx.request.body
  } catch (e) {
    throw error(400, 'Bad query' + (e.msg ? ': ' + e.msg : ''))
  }
}

const api = module.exports = new Router({prefix: '/entities'})

api.get('/:name', function * getCollection () {
  let query = getQuery(this)
  this.body = yield manager.getCollection(this.params.name, query, this.user)
})

api.put('/:name', function * replaceCollection () {
  let created = yield manager.replaceCollection(this.params.name, this.request.body)
  this.status = created ? 201 : 200
})

api.delete('/:name', function * removeCollection () {
  yield manager.removeCollection(this.params.name)
  this.status = 204
})

api.post('/:name', function * create () {
  yield manager.create(this.params.name, this.request.body)
  this.status = 201
})

api.get('/:name/:id', function * get () {
  let query = getQuery(this)
  this.body = yield manager.getOne(this.params.name, this.params.id, query, this.user)
  if (!this.body) {
    this.status = 404
  }
})

api.put('/:name/:id', function * replace () {
  let created = yield manager.replace(this.params.name, this.params.id, this.request.body)
  this.status = created ? 201 : 200
})

api.patch('/:name/:id', function * update () {
  yield manager.patch(this.params.name, this.params.id, this.request.body)
  this.status = 200
})

api.delete('/:name/:id', function * remove () {
  yield manager.remove(this.params.name, this.params.id)
  this.status = 204
})
