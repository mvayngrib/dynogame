const co = require('co').wrap
const debug = require('debug')('dynogame-test')
const extend = require('xtend/mutable')
const promisify = require('pify')
const dynogels = require('dynogels')
const modelsArray = require('@tradle/models').models.concat(require('@tradle/custom-models'))
const models = {}
modelsArray.forEach(m => models[m.id] = m)
// console.log(Object.keys(byId))

const formModels = [
    'tradle.PersonalInfo',
    'tradle.Verification',
  ]
  .map(id => models[id])
  // .filter(model => model.subClassOf !== 'tradle.Enum')

const {
  toDynogelsSchema,
  toDynogelsObject,
  defineTable,
  getTableName,
  // getKey
} = require('./schema-mapper-dynogels')

// const {
//   toGraphQL
// } = require('./schema-mapper-graphql')

dynogels.AWS.config.update({
  // localstack
  endpoint: 'http://localhost:4569',
  region: 'us-east-1'
})

const createTables = promisify(dynogels.createTables)
const dynogelsSchemas = {}
const tables = {}
for (const model of formModels) {
  const { id } = model
  // console.log(models['tradle.Country'])
  tables[id] = defineTable({
    model,
    models,
    objects: {
      putObject: co(function* (object) {
        debug('pretending to put object to s3', JSON.stringify(object))
      })
    }
  })
}

// Object.keys(tables).forEach(id => {
//   const table = tables[id]
//   table.
// })

const date = 1499486259331
const forms = require('./test/fixtures/conversation.json')

co(function* () {
  yield createTables()
  for (const form of forms) {
    const model = models[form.object._t]
    const table = tables[model.id]

    // hack
    form.time = date
    delete form.object.time

    debugger
    yield table.create(form)
    const result = yield table.get({
      author: form.author,
      time: form.time
    })

    console.log(result)
    // console.log(fromDynogelsObject(result))
  }

  // const Profile = tables['tradle.Profile']
  // const profile = yield promisify(Profile.create)({
  //   _time: date,
  //   _author: 'jimbob',
  //   firstName: 'jim',
  //   lastName: 'bob'
  // })

  // const result = yield promisify(Profile.get)({
  //   _time: date,
  //   _author: 'jimbob'
  // })

  // console.log(result.attrs)
})().catch(console.error)
