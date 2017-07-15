require('isomorphic-fetch')

const gql = require('graphql-tag')
const { ApolloClient, createNetworkInterface } = require('apollo-client')
const graphqlEndpoint = process.argv[2] || 'http://localhost:4000'
const client = new ApolloClient({
  networkInterface: createNetworkInterface({
    uri: graphqlEndpoint
  })
})

client.query({
    query: gql(`
      query {
        rl_tradle_FormRequest(
          filter: {
            IN: {
              form: ["tradle.PhotoID", "tradle.Selfie"]
            }
          },
          orderBy: {
            property: _author,
            desc: false
          },
          limit: 2
        ) {
          _permalink
          _time
          _link
          _author
          form
        }
      }
    `),
  })
  .then(data => console.log(prettify(data)))
  .catch(error => console.error(error));

function prettify (obj) {
  return JSON.stringify(obj, null, 2)
}
