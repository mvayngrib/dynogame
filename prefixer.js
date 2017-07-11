const { prefix } = require('./constants')

function prefixProps (props, prefix) {
  const prefixed = {}
  for (let prop in props) {
    prefixed[prefix + prop] = props[prop]
  }

  return prefixed
}

function unprefixProp (prop, prefix) {
  return prop.startsWith(prefix)
    ? prop.slice(prefix.length)
    : prop
}

function unprefixProps (props, prefix) {
  const unprefixed = {}
  for (let prop in props) {
    unprefixed[unprefixProp(prop, prefix)] = props[prop]
  }

  return unprefixed
}

function prefixSomething (val, prefix) {
  return typeof val === 'string'
    ? prefix + val
    : prefixProps(val, prefix)
}

function unprefixSomething (val, prefix) {
  return typeof val === 'string'
    ? unprefixProp(val, prefix)
    : unprefixProps(val, prefix)
}

module.exports = {
  metadata: val => prefixSomething(val, prefix.metadata),
  data: val => prefixSomething(val, prefix.data),
  prefix: prefixSomething,
  unprefix: unprefixSomething,
  unprefixMetadata: val => unprefixSomething(val, prefix.metadata),
  unprefixData: val => unprefixSomething(val, prefix.data),
  replace: (val, strip, prepend) => {
    return prefixSomething(unprefixSomething(val, strip), prepend)
  }
}
