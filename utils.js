module.exports = {
  isEmailProperty,
  isInlinedProperty,
  getProperties,
  getRequiredProperties,
  isRequired,
  getRef,
  isInstantiable,
  getInstantiableModels
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
  return model.required || Object.keys(model.properties)
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
