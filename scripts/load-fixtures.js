#!/usr/bin/env node
require('./helpers/local-config')

const path = require('path')
const fixtures = require(path.resolve(process.argv[2]))
const co = require('co').wrap
const Backend = require('../backend')
const objects = require('./helpers/keeper')

const { tables } = new Backend({
  hashKey: '_link',
  prefix: {
    metadata: 'm',
    data: 'd'
  },
  models: require('./helpers/models'),
  objects
})

co(function* () {
  const time = String(1499486259331)
  let i = 0
  for (const fixture of fixtures) {
    const table = tables[fixture._t]
    if (!fixture._time) {
      fixture._time = time + (i++)
    }

    yield objects.putObject(fixture)
    yield table.create(fixture)
  }
})().catch(console.error)
