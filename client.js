const { ApolloClient, createNetworkInterface } = require('apollo-client')
const gql = require('graphql-tag')

module.exports = function createClient ({ schemas, models, endpoint }) {
  return new ApolloClient({
    networkInterface: createNetworkInterface({
      uri: endpoint
    })
  })
}
