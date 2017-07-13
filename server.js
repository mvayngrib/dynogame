require('isomorphic-fetch')

const http = require('http')
const co = require('co').wrap
const pick = require('object.pick')
const express = require('express')
const expressGraphQL = require('express-graphql')
const dynogels = require('dynogels')
dynogels.AWS.config.update({
  // localstack
  endpoint: 'http://localhost:4569',
  region: 'us-east-1'
})

const modelsArray = require('@tradle/models').models.concat(require('@tradle/custom-models'))
const { extend, shallowClone, normalizeModels } = require('./utils')
const models = normalizeModels(modelsArray.reduce((map, model) => {
  map[model.id] = model
  return map
}, {}))

const { createSchema } = require('./schemas')
const Backend = require('./backend')
// const createResolvers = require('./resolvers')
const objects = {
  _cache: {},
  getObjectByLink: co(function* (link) {
    if (link in objects._cache) {
      return objects._cache[link]
    }

    throw new Error('not found')

    // debugger
    // throw new Error('getObjectByLink not available in this environment')
  })
}

// function inflate (fixture) {
//   const metadata = getMetadataProps(fixture)
//   const data = getDataProps(fixture)
//   const inflated = Prefixer.unprefixMetadata(metadata)
//   inflated.object = Prefixer.unprefixData(data)
//   return inflated
// }

const port = 4000
const time = String(1499486259331)
// const tables = getTables({ models, objects })
// const resolvers = createResolvers({ tables, models, objects })
const backend = new Backend({
  hashKey: '_link',
  prefix: {
    metadata: 'm',
    data: 'd'
  },
  models,
  objects
})

const { tables, resolvers } = backend
const fixtures = require('./fixtures')
co(function* () {
  let i = 0
  for (const fixture of fixtures) {
    const table = tables[fixture._t]
    fixture._time = time + (i++)
    // const flat = shallowClone(fixture, fixture.object)
    // delete flat.object
    // yield table.create(flat)
    // objects._cache[fixture[Prefixer.metadata('link')]] = inflate(fixture)
    objects._cache[fixture._link] = fixture
    yield table.create(fixture)
  }

  // const personalInfo = tables['tradle.PersonalInfo']
  // const basicInfo = tables['tradle.PersonalInfo']
  // yield ensureTables(pick(tables, 'tradle.BasicContactInfo'))
  // yield table.create({
  //   _t: 'tradle.BasicContactInfo',
  //   _s: 'somesig',
  //   [`${METADATA_PREFIX}author`]: 'bill',
  //   [`${METADATA_PREFIX}time`]: time,
  //   [`${METADATA_PREFIX}link`]: 'a',
  //   [`${METADATA_PREFIX}permalink`]: 'b',
  //   firstName: 'bill',
  //   lastName: 'preston',
  //   email: 'bill@ted.io',
  // })

  // yield table.create({
  //   _t: 'tradle.BasicContactInfo',
  //   _s: 'somesig',
  //   [`${METADATA_PREFIX}author`]: 'bill',
  //   [`${METADATA_PREFIX}time`]: time,
  //   [`${METADATA_PREFIX}link`]: 'a',
  //   [`${METADATA_PREFIX}permalink`]: 'b',
  //   // object: {
  //     firstName: 'bill',
  //     lastName: 'preston',
  //     email: 'bill@ted.io',
  //     // maritalStatus: {
  //     //   id: 'tradle.MaritalStatus_abc_123',
  //     //   title: 'married'
  //     // }
  //   // }
  // })
  // }, { overwrite: false })
})().catch(console.error)

const { schema, schemas } = createSchema({
  resolvers,
  models,
  tables,
  primaryKeys: ['link']
})

const app = express()
const GRAPHQL_PATH = '/graphql'
app.use(GRAPHQL_PATH, expressGraphQL(req => ({
  schema,
  graphiql: true,
  pretty: true
})))

app.set('port', port)
let server = http.createServer(app)
server.listen(port)

const createClient = require('./client')
const client = createClient({
  schemas,
  models,
  endpoint: `http://localhost:${port}${GRAPHQL_PATH}`
})

// setTimeout(function () {
//   const gql = require('graphql-tag')
//   client.query({
//       query: gql(`
//         query {
//           rl_tradle_PhotoID {
//             _link,
//             scan {
//               url
//             }
//           }
//         }
//       `),
//     })
//     .then(data => console.log(prettify(data)))
//     .catch(error => console.error(error));
// }, 1000)

// function prettify (obj) {
//   return JSON.stringify(obj, null, 2)
// }
