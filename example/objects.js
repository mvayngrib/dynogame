const path = require('path')
const pify = require('pify')
const fs = pify(require('fs'))
const co = require('co').wrap
const OBJECTS_FILE_PATH = path.resolve(process.cwd(), 'objects.json')
let objects
try {
  objects = require(OBJECTS_FILE_PATH)
} catch (err) {
  objects = {}
}

module.exports = {
  set: co(function* (fixtures) {
    objects = {}
    fixtures.forEach(fixture => {
      objects[fixture._link] = fixture
    })

    yield fs.writeFile(OBJECTS_FILE_PATH, JSON.stringify(objects, null, 2))
  }),
  get: co(function* (link) {
    const val = objects[link]
    if (!val) {
      throw new Error('not found')
    }

    return val
  })
}
