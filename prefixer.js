const { prefix } = require('./constants')
const prefixProp = (prop, prefix) => prefix + prop
const prefixMetadataProp = prop => prefixProp(prop, prefix.metadata)
const prefixMetadataProps = props => prefixProps(props, prefix.metadata)
const prefixDataProp = prop => prefixProp(prop, prefix.data)
const prefixDataProps = props => prefixProps(props, prefix.data)

function prefixProps (props, prefix) {
  const prefixed = {}
  for (let prop in props) {
    prefixed[prefixProp(prop, prefix)] = props[prop]
  }

  return prefixed
}

module.exports = {
  metadataProp: prefixMetadataProp,
  metadataProps: prefixMetadataProps,
  dataProp: prefixDataProp,
  dataProps: prefixDataProps,
  props: prefixProps
}
