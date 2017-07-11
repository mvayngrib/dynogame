const debug = require('debug')('tradle:dynogels-mapper')
const Joi = require('joi')
const dynogels = require('dynogels')
const createResolvers = require('./resolvers')
const Prefixer = require('./prefixer')
const {
  co,
  clone,
  extend,
  promisify,
  // getMetadataProps,
  getIndexes,
} = require('./utils')

const { hashKey, rangeKey } = require('./constants')
const slimmer = require('./slim')
const { toJoi } = require('./joi')
const Errors = require('./errors')
const RESOLVED = Promise.resolve()

const metadataTypes = Prefixer.metadata({
  // id: Joi.string(),
  // title: Joi.string(),
  link: Joi.string(),
  permalink: Joi.string(),
  author: Joi.string(),
  time: Joi.string(),
})

// don't prefix for now, disallow _ as first character in model props
const ensureTablesCache = {}
const ensureTables = co(function* (tables) {
  for (let id in tables) {
    if (!(id in ensureTablesCache)) {
      ensureTablesCache[id] = tables[id].createTable()
    }

    try {
      yield ensureTablesCache[id]
    } catch (err) {
      if (err.code === 'ResourceInUseException') {
        ensureTablesCache[id] = RESOLVED
      } else {
        delete ensureTablesCache[id]
        throw err
      }
    }
  }
})

// function inflate (object) {
//   // const metadataProps = Object.keys(object).filter(prop => prop.startsWith(METADATA_PREFIX))
//   // const dataProps = Object.keys(object).filter(prop => prop.startsWith(DATA_PREFIX))
//   const recovered = {
//     object: {}
//   }

//   for (let prop in object) {
//     if (prop.startsWith(prefix.metadata)) {
//       recovered[prop.slice(prefix.metadata.length)] = object[prop]
//     } else if (prop.startsWith(prefix.data)) {
//       recovered.object[prop.slice(prefix.data.length)] = object[prop]
//     } else {
//       throw new Error(`unexpected property ${prop}`)
//     }
//   }

//   return recovered
// }

function inflate (object) {
  return object
}

function deflate (object) {
  return object
}

function toDynogelsSchema ({ model, models }) {
  const schema = extend(
    metadataTypes,
    Prefixer.data(toJoi({ model, models }))
  )

  const spec = {
    hashKey,
    tableName: getTableName(model),
    timestamps: true,
    createdAt: false,
    updatedAt: Prefixer.metadata('dateUpdated'),
    schema,
    indexes: getIndexes({ model, models })
  }

  if (rangeKey) spec.rangeKey = rangeKey

  return spec
}

function getTable ({ model, models, objects }) {
  const schema = toDynogelsSchema({ model, models })
  const table = dynogels.define(model.id, schema)
  return wrapTable({ table, model, objects })
}

function wrapInstance (instance) {
  const promisified = promisify(instance, {
    include: ['save', 'update', 'destroy']
  })

  promisified.toJSON = () => inflate(instance.toJSON())
  return promisified
}

function wrapTable ({ table, model, objects }) {
  table = promisify(table, {
    include: ['createTable', 'create', 'get', 'update', 'destroy']
  })

  const _get = rangeKey
    ? key => table.get(key[hashKey], key[rangeKey])
    : key => table.get(key[hashKey])

  const get = co(function* (key) {
    const result = yield _get(key)
    return result && wrapInstance(result)
  })

  // const create = co(function* (item, options={}) {
  //   const result = yield table.create(deflate(item), options)
  //   return wrapInstance(result)
  // })

  const createWriteMethod = function createWriteMethod (method) {
    return co(function* (item, options) {
      item = deflate(item)
      const slim = slimmer.slim({ item, model })
      const putSlim = table[method](slim, options)
      const putFat = slim === item ? RESOLVED : objects.putObject(item)
      // const result = yield table.update(deflate(item), options)
      const [result] = yield [putSlim, putFat]
      return wrapInstance(result)
    })
  }

  const create = createWriteMethod('create')
  const update = createWriteMethod('update')

  const destroy = co(function* (key, options) {
    const result = yield table.destroy(deflate(key), options)
    return wrapInstance(result)
  })

  const crud = wrapFunctionsWithEnsureTable({
    table,
    model,
    object: { create, get, update, destroy }
  })

  return extend(crud, {
    createTable: () => table.createTable(),
    query: (...args) => wrapOperation({
      table,
      model,
      op: table.query(...args)
    }),
    scan: (...args) => wrapOperation({
      table,
      model,
      op: table.scan(...args)
    })
  })
}

// TODO: wrap, instead of overwrite
function wrapOperation ({ table, model, op }) {
  op.exec = wrapWithEnsureTable({
    fn: promisify(op.exec.bind(op)),
    table,
    model
  })

  return op
}

function wrapFunctionsWithEnsureTable ({ object, model, table }) {
  const ensured = {}
  Object.keys(object).forEach(key => {
    const val = object[key]
    if (typeof val === 'function') {
      ensured[key] = wrapWithEnsureTable({ fn: val, model, table })
    } else {
      ensured[key] = val
    }
  })

  return ensured
}

function wrapWithEnsureTable ({ fn, model, table }) {
  return co(function* (...args) {
    yield ensureTables({
      [model.id]: table
    })

    const result = yield fn.apply(this, args)
    if (result) {
      if (result.Item) {
        result.Item = wrapInstance(result.Item)
      } else if (result.Items) {
        result.Items = result.Items.map(item => wrapInstance(item))
      }
    }

    return result
  })
}

function getTables ({ models, objects }) {
  const tables = {}
  Object.keys(models).forEach(id => {
    const model = models[id]
    let table
    Object.defineProperty(tables, model.id, {
      enumerable: true,
      get: function () {
        if (!table) {
          table = getTable({ model, models, objects })
        }

        return table
      }
    })
  })

  return tables
}

function getTableName (model) {
  const id = model.id || model
  return id.replace(/[.]/g, '_')
}

function getResolvers ({ tables, models, objects }) {
  if (!tables) tables = getTables({ models, objects })

  return createResolvers({ tables, models, objects })
}

module.exports = {
  toDynogelsSchema,
  deflate,
  inflate,
  getTableName,
  // getKey,
  getTable,
  getTables,
  ensureTables,
  getResolvers
  // list
}
