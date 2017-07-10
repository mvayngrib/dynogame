const debug = require('debug')('tradle:graphql-resolvers')
const {
  co,
  extend,
  pick,
  omit,
  deepEqual,
  promisify,
  getMetadataProps,
  getRequiredProperties,
  getIndexes
} = require('./utils')

const { filterResults } = require('./compare')
const { hashKey } = require('./constants')

module.exports = function createResolvers ({ tables, models, objects }) {
  const runQuery = co(function* ({ model, key, props }) {
    let query = tables[model.id].query(key.value)
    if (key.index) {
      query = query.usingIndex(key.index)
    }

    const result = yield query.exec()
    return postProcessSearchResult({ model, result, props })
  })

  const runSearch = co(function* ({ model, props }) {
    // debug('scanning based on arbitrary attributes is not yet implemented')
    // maybe check if query is possible, then filter the results
    // otherwise scan
    debug('TODO: implement more efficient scanning')
    const result = yield tables[model.id].scan().exec()
    return postProcessSearchResult({ model, result, props })
  })

  function postProcessSearchResult ({ model, result, props }) {
    const { Count, Items } = result
    if (!Count) return []

    const resources = resultsToJson(Items)
    return filterResults({ model, resources, props })
  }

  const update = co(function* ({ model, props }) {
    const result = yield tables[model.id].update(props)
    return resultsToJson(result)
  })

  const get = co(function* ({ model, key }) {
    const result = yield tables[model.id].get(key)
    return result ? resultsToJson(result) : null
  })

  const list = co(function* ({ model, source, args, context, info }) {
    const props = args
    const primaryOrIndexKey = getQueryBy({ model, props })
    let results
    if (primaryOrIndexKey) {
      results = yield runQuery({ model, props, key: primaryOrIndexKey })
    } else {
      results = yield runSearch({ model, props })
    }

    if (!results.length) return results

    const required = getRequiredProperties(model)
    const first = results[0]
    const missing = required.filter(prop => !(prop in first))
    if (missing.length) {
      debug(`missing properties: ${missing.join(', ')}`)
    }

    // for now
    return results
  })

  function getQueryBy ({ model, props }) {
    if (hashKey in props) {
      return {
        value: props[hashKey],
        // rangeKey: props[rangeKey]
      }
    }

    // TODO: lazify, cachify
    const index = getIndexes({ model, models })
      .find(({ hashKey }) => hashKey in props)

    if (index) {
      return {
        index: index.name,
        value: props[index.hashKey],
        // rangeKey: props[index.rangeKey]
      }
    }
  }

  return {
    list,
    get,
    update
  }
}

function resultsToJson (items) {
  if (Array.isArray(items)) {
    return items.map(item => {
      return item.toJSON ? item.toJSON() : item
    })
  }

  return items.toJSON ? items.toJSON() : items
}
