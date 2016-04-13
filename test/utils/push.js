'use strict'

var expect = require('chai').expect
var mqtt = require('mqtt')
var config = require('../../lib/config')
var client = mqtt.connect(`mqtt://localhost:${config.MQTT_PORT}`)

var expected = []
var index = 0
var over = false
var waitMessages, resolver, rejector

function reset () {
  expected = []
  index = 0
  over = false
  waitMessages = new Promise((resolve, reject) => {
    resolver = resolve
    rejector = reject
  })
}

function expectMessage (topic, message) {
  expected.push({topic, message})
}

function messageReceived (topic, message) {
  console.log('mqtt arrived: ' + topic + '; ' + message)
  if (index >= expected.length) {
    rejector()
    throw new Error('Unexpected message received on topic: ' + topic.toString() + ': ' + message.toString())
  }
  const current = expected[index++]
  current.topic && expect(topic.toString()).to.eql(current.topic)
  current.message && expect(message.toString()).to.eql(current.message)

  checkTestOver()
}

function checkTestOver () {
  console.log(`Checking end condition: Index: ${index}, Expected length: ${expected.length} over: ${over}`)
  if (index === expected.length && over) {
    resolver()
  }
}

function pushSetup () {
  before((done) => {
    client.subscribe('#', () => {
      client.on('message', messageReceived)
      done()
    })
  })

  after(() => {
    client.end()
  })

  beforeEach(() => {
    reset()
  })
}

function wait () {
  over = true
  checkTestOver()
  return waitMessages
}

module.exports = {
  setup: pushSetup,
  expect: expectMessage,
  wait: wait
}
