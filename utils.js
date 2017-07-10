const co = require('co').wrap
const promisify = require('pify')
const clone = require('clone')
const shallowClone = require('xtend')
const extend = require('xtend/mutable')
const deepEqual = require('deep-equal')
const pick = require('object.pick')
const omit = require('object.omit')
const { GraphQLNonNull } = require('graphql')
const TYPE = '_t'
const SIG = '_s'
const SEQ = '_n'
const PERMALINK = '_r'
const PREVLINK = '_p'
const PREV_TO_SENDER = '_q'
const STRING_TYPE = {
  type: 'string'
}

const STUB_PROPS = ['id', 'title']

const PROTOCOL_PROPS = {
  [TYPE]: STRING_TYPE,
  [SIG]: STRING_TYPE,
  [SEQ]: STRING_TYPE,
  [SIG]: STRING_TYPE,
  [PREV_TO_SENDER]: STRING_TYPE,
  [SEQ]: {
    type: 'number'
  }
}

const PROTOCOL_PROP_NAMES = Object.keys(PROTOCOL_PROPS)
const REQUIRED_PROTOCOL_PROPS = [TYPE, SIG]
const getMetadataProps = object => pick(object, ['link', 'permalink', 'time', 'author'])
const defaultIndexes = require('./constants').indexes

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
  getMetadataProps,
  getIndexes
}

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
    .filter(propertyName => {
      return propertyName.charAt(0) !== '_'
    })
}

function getInstantiableModels (models) {
  return Object.keys(models).filter(id => isInstantiable(models[id]))
}

function isInstantiable (model) {
  const { id, isInterface } = model
  if (id === 'tradle.Model' || isInterface) {
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

function cachify (fn, getId) {
  const byId = {}
  return function (...args) {
    const id = getId(...args)
    if (!(id in byId)) {
      byId[id] = fn.apply(this, args)
    }

    return byId[id]
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

function normalizeModels (models) {
  return mapObject(models, withProtocolProps)
}

function isResourceStub (props) {
  const keys = Object.keys(props)
  return keys.length === STUB_PROPS.length &&
    deepEqual(keys.sort(), STUB_PROPS)
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
