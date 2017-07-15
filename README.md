# @tradle/dynamo-graphql

DynamoDB + GraphQL based on built-in or custom Tradle models

## Usage

### Local

```sh
yarn dynamo       # start local dynamodb (Docker is required)
yarn loadfixtures # load some data into
yarn server       # start the server
yarn client       # run a sample query

# open localhost:4000 for GraphiQL
# open localhost:4569 for DynamoDB admin interface
```

#### Inspect Schema

Generate the schema:

```sh
yarn genschema
# open ./schema.graphl
```
