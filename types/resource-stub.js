const pick = require('object.pick')
const { Kind } = require('graphql/language')
const {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLNonNull
} = require('graphql/type')

function identity (value) {
  return value
}

function parseLiteral (ast) {
  const stub = ast.fields.reduce((props, field) => {
    props[field.name.value] = field.value.value
    return props
  }, {})

  return pick(stub, ['id', 'title'])
}

// example:
// http://dev.apollodata.com/tools/graphql-tools/scalars.html#Date-as-a-scalar

const fields = {
  id: {
    type: new GraphQLNonNull(GraphQLString)
  },
  title: {
    type: GraphQLString
  }
}

const ResourceStubInputType = new GraphQLInputObjectType({
  name: 'ResourceStubInput',
  description: 'resource stub',
  // value sent to the client
  serialize: identity,
  // // value sent by the client
  parseValue: identity,
  parseLiteral,
  fields
})

const ResourceStubOutputType = new GraphQLObjectType({
  name: 'ResourceStub',
  description: 'resource stub',
  // value sent to the client
  fields
})

module.exports = {
  input: ResourceStubInputType,
  output: ResourceStubOutputType
}
