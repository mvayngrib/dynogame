#!/usr/bin/env node
require('./local-config')

const path = require('path')
const fixtures = require(path.resolve(process.argv[2]))
const co = require('co').wrap
const { AWS } = require('dynogels')
const objects = require('./objects')
const models = require('./models')
const docClient = new AWS.DynamoDB.DocumentClient({
  endpoint: 'http://localhost:4569',
  region: 'us-east-1'
})

const db = require('@tradle/dynamodb')
  .proxy({ objects, models, maxItemSize: 5000, docClient })

co(function* () {
  const time = String(1499486259331)
  let i = 0
  let saved = 0
  let saving = 0

  yield objects.set(fixtures)
  const byTable = {}
  for (const fixture of fixtures) {
    const type = fixture._t
    if (!byTable[type]) {
      byTable[type] = []
    }

    byTable[type].push(fixture)
  }

  console.log('patience...')
  yield Object.keys(byTable).map(co(function* (type) {
    saving += byTable[type].length
    yield db.batchPut(byTable[type])
    saving -= byTable[type].length
    saved += byTable[type].length
    console.log(`${saved}/${fixtures.length} items saved`)
  }))

})().catch(console.error)
