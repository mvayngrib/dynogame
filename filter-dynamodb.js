
const debug = require('debug')('tradle:graphql-filter-dynamodb')
const { toObject, getIndexes } = require('./utils')
const OPERATORS = require('./operators')
const { hashKey } = require('./constants')

module.exports = function filterViaDynamoDB ({ table, model, filter, orderBy }) {
  const indexes = getIndexes({ model })
  const usedProps = getUsedProperties({ model, filter })
  const indexedProps = indexes.map(index => index.hashKey)
    .concat(hashKey)

  const indexedPropsMap = toObject(indexedProps)
  const usedIndexedProps = usedProps.filter(prop => {
    return filter.EQ && prop in filter.EQ && prop in indexedPropsMap
  })

  const opType = usedIndexedProps.length
    ? 'query'
    : 'scan'

  let builder = table[opType]
  let queryProp
  if (opType === 'query') {
    if (usedIndexedProps.includes(hashKey)) {
      queryProp = hashKey
    } else {
      queryProp = usedIndexedProps[0]
    }

    builder = builder(filter.EQ[queryProp])
    if (queryProp !== hashKey) {
      const index = indexes.find(i => i.hashKey === queryProp)
      builder = builder.usingIndex(index.name)
    }

    if (orderBy.property === queryProp) {
      if (orderBy.desc) {
        builder = builder.descending()
      } else {
        builder = builder.ascending()
      }
    }

  } else {
    builder = builder()
  }

  for (let op in filter) {
    let val = filter[op]
    for (let prop in val) {
      if (prop in OPERATORS) {
        debug('nested operators not support (yet)')
        continue
      }

      if (op === 'EQ') {
        if (prop !== queryProp) {
          builder = builder.where(prop).equals(val[prop])
        }
      } else if (op === 'STARTS_WITH') {
        builder = builder.where(prop).beginsWith(val[prop])
      } else if (op === 'IN') {
        builder = builder.where(prop).in(val[prop])
      } else if (op === 'BETWEEN') {
        let pVal = val[prop]
        builder = builder.where(prop).between(...pVal)
      } else {
        debug(`unsupported operator ${op}`)
      }
    }
  }

  return builder
}

function getUsedProperties ({ model, filter }) {
  const flat = flatten(filter)
  return flat.reduce((all, obj) => {
    return all.concat(Object.keys(obj))
  }, [])
}

// function usesNonPrimaryKeys ({ model, filter }) {
//   return props.some(prop => !indexed[prop])
// }

/**
 * flattens nested filter
 *
 * has no semantic meaning, this is just to be able to check
 * which props are being filtered against
 */
function flatten (filter) {
  const flat = []
  const batch = [filter]
  let len = batch.length
  while (true) {
    let copy = batch.slice()
    batch.length = 0
    copy.forEach(subFilter => {
      for (let op in subFilter) {
        if (op in OPERATORS) {
          batch.push(subFilter[op])
        } else {
          flat.push(subFilter)
        }
      }
    })

    if (!batch.length) {
      break
    }
  }

  return flat
}
