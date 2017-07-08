const express = require('express')
const expressGraphQL = require('express-graphql')
const modelsArray = require('@tradle/models').models.concat(require('@tradle/custom-models'))
const models = {}
modelsArray.forEach(m => models[m.id] = m)

const { createSchema } = require('./schema-mapper-graphql')
debugger
const schema = createSchema({ models })

const app = express()
app.use('/graphql', expressGraphQL(req => ({
    schema,
    graphiql: true,
    pretty: true
})))

const port = 4000
app.set('port', port)
let http = require('http')
let server = http.createServer(app)
server.listen(port)
