const { Kind } = require('graphql/language')
const { GraphQLScalarType } = require('graphql')

function serializeDate (value) {
  debugger
  if (value instanceof Date) {
    return String(value.getTime())
  } else if (typeof value === 'number') {
    return String(Math.trunc(value))
  } else if (typeof value === 'string') {
    return String(Date.parse(value))
  }

  return null
}

function parseDate (value) {
  debugger
  if (value === null) {
    return null
  }

  try {
    return new String(Date(value).getTime())
  } catch (err) {
    return null
  }
}

function parseDateFromLiteral (ast) {
  if (ast.kind === Kind.INT || !isNaN(ast.value)) {
    return String(parseInt(ast.value, 10))
  } else if (ast.kind === Kind.STRING) {
    return parseDate(ast.value)
  }

  return null
}

const TimestampType = new GraphQLScalarType({
  name: 'Timestamp',
  description:
    'The javascript `Date` as integer. Type represents date and time ' +
    'as number of milliseconds from start of UNIX epoch.',
  serialize: serializeDate,
  parseValue: parseDate,
  parseLiteral: parseDateFromLiteral,
})

module.exports = TimestampType
