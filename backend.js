// const debug = require('debug')('tradle:dynogels-mapper')
const Joi = require('joi')
const dynogels = require('dynogels')
const bindAll = require('bindall')
const createResolvers = require('./resolvers')
const createPrefixer = require('./prefixer')
const {
  co,
  extend,
  promisify,
  getIndexes,
  omit,
  shallowClone
} = require('./utils')

const minify = require('./minify')
const { toJoi } = require('./joi')
const RESOLVED = Promise.resolve()

module.exports = Backend

function Backend ({
  hashKey='link',
  rangeKey=null,
  prefix,
  models,
  objects
}) {
  bindAll(this)

  this.prefix = prefix
  this.prefixMetadata = createPrefixer(prefix.metadata).prefix
  this.prefixData = createPrefixer(prefix.data).prefix
  this.metadataTypes = this.prefixMetadata({
    // id: Joi.string(),
    // title: Joi.string(),
    link: Joi.string(),
    permalink: Joi.string(),
    author: Joi.string(),
    time: Joi.string(),
    min: Joi.boolean()
  })

  this.hashKey = this.prefixMetadata(hashKey)
  this.rangeKey = rangeKey && this.prefixMetadata(rangeKey)

  this.models = models
  this.objects = objects
  // don't prefix for now, disallow _ as first character in model props
  this._tablePromises = {}
  this.tables = this._getTables()
  this.resolvers = createResolvers({
    tables: this.tables,
    models,
    objects,
    hashKey
  })
}

Backend.prototype._ensureTablesExist = co(function* (ids) {
  ids = [].concat(ids) // coerce to array
  for (let id of ids) {
    if (!(id in this._tablePromises)) {
      this._tablePromises[id] = this.tables[id].createTable()
    }

    try {
      yield this._tablePromises[id]
    } catch (err) {
      if (err.code === 'ResourceInUseException') {
        this._tablePromises[id] = RESOLVED
      } else {
        delete this._tablePromises[id]
        throw err
      }
    }
  }
})

Backend.prototype.inflate = function inflate (object) {
  const { prefix } = this
  const recovered = {
    object: {}
  }

  for (let prop in object) {
    if (prop.startsWith(prefix.metadata)) {
      recovered[prop.slice(prefix.metadata.length)] = object[prop]
    } else if (prop.startsWith(prefix.data)) {
      recovered.object[prop.slice(prefix.data.length)] = object[prop]
    } else {
      throw new Error(`unexpected property ${prop}`)
    }
  }

  return recovered
}

Backend.prototype.deflate = function deflate (object) {
  return extend(
    this.prefixMetadata(omit(object, 'object')),
    this.prefixData(object.object)
  )
}

Backend.prototype._toDynogelsSchema = function _toDynogelsSchema ({ model }) {
  const { models } = this
  const schema = extend(
    this.metadataTypes,
    this.prefixData(toJoi({ model, models }))
  )

  const spec = {
    hashKey: this.hashKey,
    tableName: getTableName(model),
    timestamps: true,
    createdAt: false,
    updatedAt: this.prefixMetadata('dateUpdated'),
    schema,
    indexes: getIndexes({ model, models }).map(index => {
      index = shallowClone(index)
      index.hashKey = this.prefixMetadata(index.hashKey)
      if (index.rangeKey) {
        index.rangeKey = this.prefixMetadata(index.rangeKey)
      }

      return index
    })
  }

  if (this.rangeKey) spec.rangeKey = this.rangeKey

  return spec
}

Backend.prototype._getTable = function _getTable ({ model }) {
  const { models, objects } = this
  const schema = this._toDynogelsSchema({ model })
  const table = dynogels.define(model.id, schema)
  return this._wrapTable({ table, model })
}

Backend.prototype._instanceToJSON = function _instanceToJSON (instance) {
  return this.inflate(instance.toJSON())
}

Backend.prototype._wrapTable = function _wrapTable ({ table, model }) {
  const self = this
  table = promisify(table, {
    include: ['createTable', 'create', 'get', 'update', 'destroy']
  })

  const { prefix, hashKey, rangeKey, objects } = this
  const getMin = rangeKey
    ? key => table.get(key[hashKey], key[rangeKey])
    : key => table.get(key[hashKey])

  const get = co(function* (key) {
    const instance = yield getMin(self.prefixMetadata(key))
    yield self._maybeInflate({ objects, instance })
    return self._instanceToJSON(instance)
  })

  const createWriteMethod = function createWriteMethod (method) {
    return co(function* (item, options) {
      const { min, diff, isMinified } = minify({
        model,
        prefix,
        item: item.object
      })

      if (isMinified) {
        item.min = true
        item.object = min
      }

      const result = yield table[method](self.deflate(item), options)
      const json = self._instanceToJSON(result)
      return extend(json.object, diff)
    })
  }

  const create = createWriteMethod('create')
  const update = createWriteMethod('update')

  const destroy = co(function* (key, options) {
    const result = yield table.destroy(self.deflate(key), options)
    return self._instanceToJSON(result)
  })

  const opts = { table, model }
  const crud = this._wrapDBOperations({
    create,
    get,
    update,
    destroy
  }, opts)

  function scan (...args) {
    const op = table.scan(...args)
    op.exec = self._wrapDBOperation(promisify(op.exec.bind(op)), opts)
    return op
  }

  function query (...args) {
    const op = table.query(...args)
    op.exec = self._wrapDBOperation(promisify(op.exec.bind(op)), opts)
    return op
  }

  return extend(crud, {
    createTable: () => table.createTable(),
    query,
    scan
  })
}

Backend.prototype._wrapDBOperations = function _wrapDBOperations (target, opts) {
  const ensured = {}
  Object.keys(target).forEach(key => {
    const val = target[key]
    if (typeof val === 'function') {
      ensured[key] = this._wrapDBOperation(val, opts)
    } else {
      ensured[key] = val
    }
  })

  return ensured
}

Backend.prototype._wrapDBOperation = function _wrapDBOperation (fn, { model, table }) {
  const self = this
  const { objects } = this
  return co(function* (...args) {
    yield self._ensureTablesExist(model.id)

    const result = yield fn.apply(this, args)
    if (!result) return result

    let { Item, Items } = result
    if (Item) {
      yield self._maybeInflate({ objects, instance: Item })
      result.Item = self._instanceToJSON(Item)
    } else if (Items) {
      yield Promise.all(Items.map(instance => {
        return self._maybeInflate({ objects, instance })
      }))

      result.Items = Items.map(self._instanceToJSON)
    }

    return result
  })
}

Backend.prototype._maybeInflate = co(function* ({ instance }) {
  if (instance.get(this.prefixMetadata('min'))) {
    const link = instance.get(this.prefixMetadata('link'))
    const full = yield this.objects.getObjectByLink(link)
    instance.set(full.object)
  }

  return instance
})

Backend.prototype._getTables = function _getTables () {
  const self = this
  const tables = {}
  const { models, objects } = this
  Object.keys(models).forEach(id => {
    const model = models[id]
    let table
    Object.defineProperty(tables, model.id, {
      enumerable: true,
      get: function () {
        if (!table) {
          table = self._getTable({ model })
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
