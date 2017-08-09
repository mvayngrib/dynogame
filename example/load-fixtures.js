#!/usr/bin/env node
require('./local-config')

const path = require('path')
const fixtures = require(path.resolve(process.argv[2]))
const co = require('co').wrap
const objects = require('./objects')
const models = require('./models')
const tables = require('@tradle/dynamodb')
  .createTables({ objects, models, maxItemSize: 5000 })

co(function* () {
  const time = String(1499486259331)
  let i = 0
  let saved = 0

  setInterval(function () {
    console.log(`put ${saved}/${fixtures.length} items`)
  }, 1000).unref()

  yield objects.set(fixtures)
  yield fixtures.map(co(function* (fixture) {
    const type = fixture._t
    i++
    if (!fixture._time) {
      fixture._time = time + i
    }

    yield tables[type].create(fixture)
    saved++
  }))
})().catch(console.error)
