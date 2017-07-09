const co = require('co').wrap
const promisify = require('pify')
const clone = require('clone')
const shallowClone = require('xtend')
const extend = require('xtend/mutable')
const deepEqual = require('deep-equal')
const pick = require('object.pick')
const { GraphQLNonNull } = require('graphql')

module.exports = {
  co,
  promisify,
  clone,
  shallowClone,
  extend,
  deepEqual,
  pick,
  isEmailProperty,
  isInlinedProperty,
  getProperties,
  getRequiredProperties,
  getMutationProperties,
  isRequired,
  getRef,
  isInstantiable,
  getInstantiableModels,
  cachify,
  getValues,
  toNonNull,
  mapObject
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
  if (!model.required) {
    return true
  }

  return model.required.includes(propertyName)
}

function getRequiredProperties (model) {
  return model.required || [] // Object.keys(model.properties)
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

function getMutationProperties ({ model, models }) {
  const { properties } = model
  return Object.keys(properties).filter(propertyName => {
    const property = properties[propertyName]
    const { type } = property
    if (type !== 'object' && type !== 'array') {
      return true
    }

    if (isInlinedProperty({ property, models })) {
      return true
    }
  })
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
