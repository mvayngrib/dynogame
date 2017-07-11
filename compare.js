const debug = require('debug')('tradle:graphql-compare')
const {
  deepEqual,
  fromResourceStub
} = require('./utils')

module.exports = {
  filterResults,
  matchesProps,
  isEqual
}

function matchesProps ({ model, resource, props }) {
  return Object.keys(props).every(propertyName => {
    const property = model.properties[propertyName]
    return isEqual({
      model,
      propertyName,
      property,
      expected: resource[propertyName],
      value: props[propertyName]
    })
  })
}

function isEqual ({ model, property, expected, value }) {
  const { type } = property
  if (type !== 'array' && type !== 'object') {
    return deepEqual(expected, value)
  }

  if (type === 'array') {
    debug(`not comparing array valued search property`)
    return false
  }

  const metadata = fromResourceStub(expected)
  return metadata.link === value
}

function filterResults ({ model, results, props }) {
  const matchBy = Object.keys(props)
  if (!matchBy.length) return results

  return results.filter(wrapper => {
    const resource = wrapper.object
    return matchesProps({ model, resource, props })
  })
}
