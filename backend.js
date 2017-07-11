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
const minify = require('./minify')
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
  min: Joi.boolean()
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

function instanceToJSON (instance) {
  return inflate(instance.toJSON())
}

// function wrapInstance (instance) {
//   const promisified = promisify(instance, {
//     include: ['save', 'update', 'destroy']
//   })

//   promisified.toJSON = () => inflate(instance.toJSON())
//   return promisified
// }

function wrapTable ({ table, model, objects }) {
  table = promisify(table, {
    include: ['createTable', 'create', 'get', 'update', 'destroy']
  })

  const getMin = rangeKey
    ? key => table.get(key[hashKey], key[rangeKey])
    : key => table.get(key[hashKey])

  const get = co(function* (key) {
    const instance = yield getMin(key)
    yield maybeInflate({ objects, instance })
    return instanceToJSON(instance)
  })

  // const create = co(function* (item, options={}) {
  //   const result = yield table.create(deflate(item), options)
  //   return instanceToJSON(result)
  // })

  const createWriteMethod = function createWriteMethod (method) {
    return co(function* (item, options) {
      item = deflate(item)
      const { min, diff } = minify({ item, model })
      const result = yield table[method](min, options)
      result.set(diff)
      return instanceToJSON(result)
    })
  }

  const create = createWriteMethod('create')
  const update = createWriteMethod('update')

  const destroy = co(function* (key, options) {
    const result = yield table.destroy(deflate(key), options)
    return instanceToJSON(result)
  })

  const opts = { objects, table, model }
  const crud = wrapDBOperations({
    create,
    get,
    update,
    destroy
  }, opts)

  function scan (...args) {
    const op = table.scan(...args)
    op.exec = wrapDBOperation(promisify(op.exec.bind(op)), opts)
    return op
  }

  function query (...args) {
    const op = table.query(...args)
    op.exec = wrapDBOperation(promisify(op.exec.bind(op)), opts)
    return op
  }

  return extend(crud, {
    createTable: () => table.createTable(),
    query,
    scan
  })
}

function wrapDBOperations (target, opts) {
  const ensured = {}
  Object.keys(target).forEach(key => {
    const val = target[key]
    if (typeof val === 'function') {
      ensured[key] = wrapDBOperation(val, opts)
    } else {
      ensured[key] = val
    }
  })

  return ensured
}

const maybeInflate = co(function* ({ objects, instance }) {
  if (instance.get(Prefixer.metadata('min'))) {
    const link = instance.get(Prefixer.metadata('link'))
    const full = yield objects.getObjectByLink(link)
    instance.set(full.object)
  }

  return instance
})

function wrapDBOperation (fn, { objects, model, table }) {
  return co(function* (...args) {
    yield ensureTables({
      [model.id]: table
    })

    const result = yield fn.apply(this, args)
    if (!result) return result

    let { Item, Items } = result
    if (Item) {
      yield maybeInflate({ objects, instance: Item })
      result.Item = instanceToJSON(Item)
    } else if (Items) {
      yield Promise.all(Items.map(instance => maybeInflate({ objects, instance })))
      result.Items = Items.map(instanceToJSON)
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
