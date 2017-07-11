const co = require('co').wrap
const promisify = require('pify')
const clone = require('clone')
const shallowClone = require('xtend')
const extend = require('xtend/mutable')
const deepEqual = require('deep-equal')
const pick = require('object.pick')
const omit = require('object.omit')
const { GraphQLNonNull } = require('graphql')
const constants = require('./constants')
const ResourceStubType = require('./types/resource-stub')
const { TYPE, SIG, SEQ, PREV_TO_SENDER, defaultIndexes } = constants
const STRING_TYPE = {
  type: 'string'
}

// const STUB_PROPS = ['id', 'title']
const PROTOCOL_PROPS = {
  [TYPE]: STRING_TYPE,
  [SIG]: STRING_TYPE,
  [PREV_TO_SENDER]: STRING_TYPE,
  [SEQ]: {
    type: 'number'
  }
}

// const PROTOCOL_PROP_NAMES = Object.keys(PROTOCOL_PROPS)
const REQUIRED_PROTOCOL_PROPS = [TYPE, SIG]
// const METADATA_PROP_NAMES = getValues(metadataProperties)
// const METADATA_PROP_NAMES = Object.keys(metadataProperties)

// const prefixProp = (prop, prefix) => prefix + prop
// const prefixMetadataProp = prop => prefixProp(prop, prefix.metadata)
// const prefixMetadataProps = props => prefixProps(props, prefix.metadata)
// const prefixDataProp = prop => prefixProp(prop, prefix.data)
// const prefixDataProps = props => prefixProps(props, prefix.data)
// const prefixProps = (props, prefix) => {
//   const prefixed = {}
//   for (let prop in props) {
//     prefixed[prefixProp(prop, prefix)] = props[prop]
//   }

//   return prefixed
// }

// const getMetadataProps = object => pick(object, METADATA_PROP_NAMES)
// const getDataProps = object => omit(object, METADATA_PROP_NAMES)

function isEmailProperty ({ propertyName, property }) {
  if (property.type === 'string') {
    return property.keyboard === 'email-address' || /email/i.test(propertyName)
  }
}

function isInlinedProperty ({
  property,
  models
}) {
  const { ref, inlined, range } = property
  if (inlined || range === 'json') return true

  if (ref) {
    const propModel = models[ref]
    return propModel.inlined
  }

  return property.items && !property.items.ref
}

function isRequired ({ model, propertyName }) {
  return getRequiredProperties(model).includes(propertyName)
}

function getRequiredProperties (model) {
  return model.required
}

function getRef (property) {
  return property.ref || (property.items && property.items.ref)
}

function getProperties (model) {
  return Object.keys(model.properties)
    // .filter(propertyName => {
    //   return propertyName.charAt(0) !== '_'
    // })
}

function getInstantiableModels (models) {
  return Object.keys(models).filter(id => isInstantiable(models[id]))
}

function isInstantiable (model) {
  const { id, isInterface, abstract } = model
  if (id === 'tradle.Model' || isInterface || abstract) {
    return false
  }

  return true
}

function getOnCreateProperties ({ model, models }) {
  return Object.keys(model.properties).filter(propertyName => {
    return isSetOnCreate({ model, propertyName })
  })
}

function isSetOnCreate ({ model, propertyName }) {
  const property = model.properties[propertyName]
  return !property.backlink

  // const { type } = property
  // if (type !== 'object' && type !== 'array') {
  //   return true
  // }

  // if (isInlinedProperty({ property, models })) {
  //   return true
  // }

  // if (!property.backlink) return true
}

function cachify (fn, getId, cache={}) {
  return function (...args) {
    const id = getId(...args)
    if (!(id in cache)) {
      cache[id] = fn.apply(this, args)
    }

    return cache[id]
  }
}

function getValues (obj) {
  return Object.keys(obj).map(key => obj[key])
}

function toNonNull (types) {
  return mapObject(types, wrapper => {
    return shallowClone(wrapper, {
      type: new GraphQLNonNull(wrapper.type)
    })
  })
}

function mapObject (obj, mapper) {
  const mapped = {}
  for (let key in obj) {
    mapped[key] = mapper(obj[key])
  }

  return mapped
}

// function filterObject (obj, filter) {
//   const filtered = {}
//   for (let key in obj) {
//     let val = obj[key]
//     if (filter(val)) {
//       filtered[key] = val
//     }
//   }

//   return filtered
// }

function withProtocolProps (model) {
  let required = model.required || []
  while (true) {
    let expanded = expandGroupProps(model, required)
    if (expanded.length === required.length) {
      break
    }

    required = expanded
  }

  return shallowClone(model, shallowClone({
    properties: shallowClone(model.properties, PROTOCOL_PROPS),
    required: unique(required.concat(REQUIRED_PROTOCOL_PROPS))
  }))
}

function expandGroupProps (model, arr) {
  return arr.reduce((props, name) => {
    const { group } = model.properties[name]
    if (group) {
      // nested group props should be caught in @tradle/validate-model
      return props.concat(group)
    }

    return props.concat(name)
  }, [])
}

function unique (strings) {
  const obj = {}
  for (let str of strings) {
    if (!(str in obj)) {
      obj[str] = true
    }
  }

  return Object.keys(obj)
}

// function hasNonProtocolProps (model) {
//   return !!Object.keys(omit(model.properties, PROTOCOL_PROP_NAMES)).length
// }

function normalizeModels (models) {
  // models = filterObject(models, model => {
  //   return !isInstantiable(model) || hasNonProtocolProps(model)
  // })

  const whole = mapObject(models, withProtocolProps)
  return whole
  // return fixEnums(addedProtocol)
}

// function fixEnums (models) {
//   for (let id in models) {
//     let model = models[id]
//     if (model.subClassOf === 'tradle.Enum' && !model.enum) {
//       model.enum =
//     }
//   }
// }

function isResourceStub (props) {
  const keys = Object.keys(props)
  return keys.length === ResourceStubType.propertyNames &&
    deepEqual(keys.sort(), ResourceStubType.propertyNames)
}

function fromResourceStub (props) {
  const [type, permalink, link] = props.id.split('_')
  return {
    [TYPE]: type,
    link,
    permalink
  }
}

function getIndexes ({ model, models }) {
  return defaultIndexes
}

// function getNonProtocolProps (props) {
//   return omit(props, Object.keys(PROTOCOL_PROP_NAMES))
// }

module.exports = {
  co,
  promisify,
  clone,
  shallowClone,
  extend,
  deepEqual,
  pick,
  omit,
  // getNonProtocolProps,
  isResourceStub,
  fromResourceStub,
  isEmailProperty,
  isInlinedProperty,
  getProperties,
  getRequiredProperties,
  getOnCreateProperties,
  isRequired,
  getRef,
  isInstantiable,
  getInstantiableModels,
  cachify,
  getValues,
  toNonNull,
  mapObject,
  withProtocolProps,
  normalizeModels,
  // getMetadataProps,
  // getDataProps,
  getIndexes
}
