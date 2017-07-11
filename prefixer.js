function prefixProps (prefix, props) {
  const prefixed = {}
  for (let prop in props) {
    prefixed[prefix + prop] = props[prop]
  }

  return prefixed
}

function unprefixProp (prefix, prop) {
  return prop.startsWith(prefix)
    ? prop.slice(prefix.length)
    : prop
}

function unprefixProps (prefix, props) {
  const unprefixed = {}
  for (let prop in props) {
    unprefixed[unprefixProp(prefix, prop)] = props[prop]
  }

  return unprefixed
}

function prefixSomething (prefix, val) {
  return typeof val === 'string'
    ? prefix + val
    : prefixProps(prefix, val)
}

function unprefixSomething (prefix, val) {
  return typeof val === 'string'
    ? unprefixProp(prefix, val)
    : unprefixProps(prefix, val)
}

module.exports = function createPrefixer (prefix) {
  return {
    // metadata: val => prefixSomething(val, metadata),
    // data: val => prefixSomething(val, data),
    prefix: prefixSomething.bind(null, prefix),
    unprefix: unprefixSomething.bind(null, prefix),
    // unprefixMetadata: val => unprefixSomething(val, metadata),
    // unprefixData: val => unprefixSomething(val, data),
    replace: (val, oldPrefix, newPrefix) => {
      return prefixSomething(newPrefix, unprefixSomething(oldPrefix, val))
    }
  }
}
