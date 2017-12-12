// tests.js

var _ = require('lodash')
var assert = require('assert')

const fs = require('fs')
const path = require('path')

require('util.promisify/shim')()
const redis = require('redis-promisify')

const index = require('./index')

const autocompleteEvent = {
    'name': 'spiced vegetables'
}

const filterEvent = {
    'ingredientIds': ['DfgIn-bx','N2YXf2ns','jnZf_ewk'],
	'spiceLevels': ['Hot'],
	'regions': ['Indian Subcontinent'],
	'overnightPreparation': false,
	'collections': ['Curries','Side dishes'],
	'cuisines': ['South Indian'],
    'totalTimes': ['Regular'],
    'vegan': false
}

const whenLoadTestData = () => {
    const testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'testdata.json')))
    const client = redis.createClient(process.env.CACHE_ENDPOINT)
    return client.flushdbAsync()
                .then(() => {
                    const trans = client.multi()
                    for (const key of _.keys(testData))
                    {
                        if (Array.isArray(testData[key]))
                            trans.sadd(key,testData[key])
                        else
                        {
                            for (const hashField of _.keys(testData[key]))
                                trans.hset(key, hashField, testData[key][hashField])
                        }
                    }
                    return trans.execAsync()
                })
                .then(() => client.quitAsync())
}

let testMessages = [], tests = []
  
tests.push(index.whenHandler()
            .catch(err => {
                testMessages.push('Errors are bubbled up')
                assert.equal(err.message, 'Invalid event - undefined')
                return Promise.resolve()
            }))

tests.push(whenLoadTestData()
                .then(() => index.whenHandler(filterEvent))
                .then(results => {
                    testMessages.push('Filter recipes')
                    assert.deepEqual(results, ['NXkkUWRu'])
                    return Promise.resolve()
                })         
                .then(() => index.whenHandler(autocompleteEvent))
                .then(results => {
                    testMessages.push('Autocomplete recipe name')
                    assert.deepEqual(results, [{name: 'Slow-Cooked Spiced Vegetables and Rice', id: '3uDSc4Vg'}])
                    return Promise.resolve()
                })
            )            

Promise.all(tests)
        .then(() => {
            console.info(_.map(testMessages, m => m + ' - passed').join('\n'))
            process.exit()
        })


