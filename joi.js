const Joi = require('joi')
const {
  isEmailProperty,
  isInlinedProperty,
  shallowClone
} = require('./utils')

module.exports = {
  toJoi
}

function toJoi ({ model, models }) {
  const { properties, required } = model
  const joiProps = {}
  for (let propertyName in properties) {
    let property = properties[propertyName]
    joiProps[propertyName] = toJoiProp({ propertyName, property, model, models })
  }

  for (let name of required) {
    joiProps[name] = joiProps[name].required()
  }

  return joiProps
}

function toJoiProp ({
  propertyName,
  property,
  model,
  models
}) {
  const { type } = property
  switch (type) {
  case 'string':
    return toJoiStringProperty({ propertyName, property })
  case 'number':
    return toJoiNumberProperty({ propertyName, property })
  case 'date':
    return Joi.date()
  case 'boolean':
    return Joi.boolean()
  case 'array':
    return Joi.array().items(toJoiProp({
      propertyName,
      property: shallowClone(property, { type: 'object' }),
      model,
      models
    }))

  case 'object':
    const isInlined = isInlinedProperty({
      property,
      model,
      models
    })

    if (isInlined) {
      return Joi.object()
    }

    return Joi.object({
      id: Joi.string(),
      title: Joi.string().allow('', null)
    })
  default:
    throw new Error(`unknown type: ${type}`)
  }
}

function toJoiNumberProperty ({ propertyName, property }) {
  let joiProp = Joi.number()
  if (property.maxLength) {
    joiProp = joiProp.max(Math.pow(10, property.maxLength) - 1)
  }

  if (property.minLength) {
    joiProp = joiProp.min(Math.pow(10, property.minLength) - 1)
  }

  return joiProp
}

function toJoiStringProperty ({ propertyName, property }) {
  let joiProp = Joi.string()
  if (isEmailProperty({ propertyName, property })) {
    joiProp = joiProp.email()
  } else if (property.pattern) {
    joiProp = joiProp.regex(new RegExp(property.pattern))
  }

  if (property.maxLength) {
    joiProp = joiProp.max(Math.pow(10, property.maxLength) - 1)
  }

  if (property.minLength) {
    joiProp = joiProp.min(Math.pow(10, property.minLength) - 1)
  }

  return joiProp
}