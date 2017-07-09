const Joi = require('joi')
const dynogels = require('dynogels')
const {
  co,
  extend,
  pick,
  omit,
  promisify,
} = require('./utils')
const createTables = promisify(dynogels.createTables)
const constants = require('./constants')
const slimmer = require('./slim')
const { toJoi } = require('./joi')
const { hashKey, rangeKey, indexes } = constants
const METADATA_PREFIX = constants.prefix.metadata
const DATA_PREFIX = constants.prefix.data
const RESOLVED = Promise.resolve()
// const METADATA_PREFIX = 'm'
// const DATA_PREFIX = 'd'
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
      if (err.code !== 'ResourceInUseException') {
        delete ensureTablesCache[id]
        throw err
      }
    }
  }
})

function inflate (object) {
  // const metadataProps = Object.keys(object).filter(prop => prop.startsWith(METADATA_PREFIX))
  // const dataProps = Object.keys(object).filter(prop => prop.startsWith(DATA_PREFIX))
  const recovered = {
    object: {}
  }

  for (let prop in object) {
    if (prop.startsWith(METADATA_PREFIX)) {
      recovered[prop.slice(METADATA_PREFIX.length)] = object[prop]
    } else if (prop.startsWith(DATA_PREFIX)) {
      recovered.object[prop.slice(DATA_PREFIX.length)] = object[prop]
    } else {
      throw new Error(`unexpected property ${prop}`)
    }
  }

  return recovered
}

function deflate (object) {
  const metadataProps = getMetadataProps(object)
  return extend(
    prefixMetadataProps(metadataProps),
    omit(object, metadataProps)
  )

  // return extend(
  //   prefixMetadataProps(getMetadataProps(object)),
  //   prefixDataProps(object.object)
  // )
}

const getMetadataProps = object => pick(object, ['link', 'permalink', 'time', 'author'])
const prefixProp = (prop, prefix) => prefix + prop
const prefixMetadataProp = prop => prefixProp(prop, METADATA_PREFIX)
const prefixMetadataProps = props => prefixProps(props, METADATA_PREFIX)
const prefixDataProp = prop => prefixProp(prop, DATA_PREFIX)
const prefixDataProps = props => prefixProps(props, DATA_PREFIX)

function prefixProps (props, prefix) {
  const prefixed = {}
  for (let prop in props) {
    prefixed[prefixProp(prop, prefix)] = props[prop]
  }

  return prefixed
}

function toDynogelsSchema ({ model, models }) {
  const schema = toJoi({ model, models })
  schema[prefixProp('time', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('author', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('link', METADATA_PREFIX)] = Joi.string()
  schema[prefixProp('permalink', METADATA_PREFIX)] = Joi.string()
  return {
    // metadata prop
    // hashKey: prefixProp('time', METADATA_PREFIX),
    // rangeKey: prefixProp('author', METADATA_PREFIX),
    rangeKey,
    hashKey,
    tableName: getTableName(model),
    timestamps: true,
    createdAt: false,
    updatedAt: prefixProp('dateUpdated'),
    schema,
    indexes: indexes.concat(getIndexes({ model, models }))
  }
}

function getIndexes ({ model, models }) {
  return []
}

function getTable ({ model, models, objects }) {
  const schema = toDynogelsSchema({ model, models })
  const table = dynogels.define(model.id, schema)
  return wrapTable({ table, model, objects })
}

function wrapInstance (instance) {
  return promisify(instance, {
    include: ['save', 'update', 'destroy']
  })

  // return {
  //   metadata: prop => instance.get(prefixMetadataProp(prop)),
  //   get: prop => prop ? instance.get(prefixDataProp(prop)) : instance.get(),
  //   set: prop => props => instance.set(prefixDataProps(props)),
  //   save: promisify(instance.save.bind(instance)),
  //   update: promisify(instance.update.bind(instance)),
  //   destroy: promisify(instance.destroy.bind(instance)),
  //   toPlainObject: toJSON,
  //   toJSON
  // }

  // function toJSON () {
  //   return inflate(instance.toJSON())
  // }
}

function wrapTable ({ table, model, objects }) {
  table = promisify(table, {
    include: ['createTable', 'create', 'get', 'update', 'destroy']
  })

  const create = co(function* (item, options={}) {
    const result = yield table.create(deflate(item), options)
    return wrapInstance(result)
  })

  const _get = rangeKey
    ? key => table.get(key[hashKey], key[rangeKey])
    : key => table.get(key[hashKey])

  const get = co(function* (key) {
    const result = yield _get(key)
    return wrapInstance(result)
  })

  const update = co(function* (item, options) {
    const slim = slimmer.slim({ item, model })
    const putSlim = table.update(deflate(item), options)
    const putFat = slim === item ? RESOLVED : objects.putObject(item)
    // const result = yield table.update(deflate(item), options)
    const [result] = yield [putSlim, putFat]
    return wrapInstance(result)
  })

  const destroy = co(function* (key, options) {
    const result = yield table.destroy(deflate(key), options)
    return wrapInstance(result)
  })

  const crud = wrapFunctionsWithEnsureTable({
    table,
    model,
    object: {
      create,
      get,
      update,
      destroy
    }
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

    return yield fn.apply(this, args)
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

module.exports = {
  toDynogelsSchema,
  deflate,
  inflate,
  getTableName,
  // getKey,
  getTable,
  getTables,
  ensureTables
  // list
}
