const pick = require('object.pick')
const { Kind } = require('graphql/language')
const { GraphQLScalarType } = require('graphql')

function identity (value) {
  return value
}

function parseLiteral (ast) {
  return ast.fields.reduce((stub, field) => {
    stub[field.name.value] = field.value.value
    return stub
  }, {})
}

// example:
// http://dev.apollodata.com/tools/graphql-tools/scalars.html#Date-as-a-scalar

const ResourceStubType = new GraphQLScalarType({
  name: 'ResourceStub',
  description: 'resource stub',
  // value sent to the client
  serialize: identity,
  // value sent by the client
  parseValue: identity,
  parseLiteral
})

module.exports = ResourceStubType
