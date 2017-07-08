module.exports = {
  isEmailProperty,
  isInlinedProperty,
  getRequiredProperties
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
  if (property.inlined) return true

  const propModel = models[property.ref]
  return propModel.inlined
}

function getRequiredProperties (model) {
  return model.required || Object.keys(model.properties)
}
