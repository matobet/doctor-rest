'use strict'

var expext = require('chai').expect
var proxyquire = require('proxyquire').noCallThru()
var auth = require('../lib/auth')

describe('Auth', () => {
  it("should fail when no 'AUTH' header specified", function * () {
    let res = yield auth({})
    expext(res).to.be.undefined
  })

  it("should fail when plugin specified in 'AUTH' does not exist", function * () {
    let res = yield auth({
      auth: 'auth_plugin_that_most_likely_does_not_exist'
    })
    expext(res).to.be.undefined
  })

  it("should use auth plugin specified in 'AUTH' header", function * () {
    let auth = withAuthPlugins({
      myplugin () {
        return Promise.resolve('42')
      }
    })

    let res = yield auth({
      auth: 'myplugin'
    })

    expext(res).to.equal('42')
  })

  function withAuthPlugins (plugins) {
    let mocks = {}
    for (let plugin of Object.keys(plugins)) {
      mocks[`doctor-rest-auth-${plugin}`] = plugins[plugin]
    }
    return proxyquire('../lib/auth', mocks)
  }
})
