#!/usr/bin/env node
require('./local-config')

const path = require('path')
const fixtures = require(path.resolve(process.argv[2]))
const co = require('co').wrap
const objects = require('./objects')
const models = require('./models')
const tables = require('@tradle/dynamodb')
  .createTables({ objects, models })

co(function* () {
  const time = String(1499486259331)
  let i = 0
  for (const fixture of fixtures) {
    const type = fixture._t
    if (!fixture._time) {
      fixture._time = time + (i++)
    }

    yield objects.put(fixture)
    yield tables[type].create(fixture)
  }
})().catch(console.error)
