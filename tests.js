// tests.js

var _ = require('lodash')
var assert = require('assert')

const fs = require('fs')
const path = require('path')

require('util.promisify/shim')()
const redis = require('redis-promisify')

const index = require('./index')

const autocompleteEvent = {
    'name': 'peanut sesame'
}

const autocompleteChatEvent = {
    'name': 'peanut sesame',
    'forChat': true
}

const filterEvent = {
    'accompanimentIds': ['NXkkUWRu'],
    'chefId': 'auth0|5710de6b3c7ae40538abdc35',
    'ingredientIds': ['-6US1xKg','GW_XXZqX','_hfTfh3z'],
	'spiceLevel': ['Hot'],
	'region': ['Indian Subcontinent'],
	'overnightPreparation': false,
	'collections': ['Dinner','Rice dishes'],
	'cuisine': ['South Indian'],
    'totalTimeInMinutes': { min: 80, max: 100 },
    'vegan': false
}

const filterChatEvent = {
    'accompanimentIds': ['NXkkUWRu'],
    'chefId': 'auth0|5710de6b3c7ae40538abdc35',
    'ingredientIds': ['-6US1xKg','GW_XXZqX','_hfTfh3z'],
	'spiceLevel': ['Hot'],
	'region': ['Indian Subcontinent'],
	'overnightPreparation': false,
	'collections': ['Dinner','Rice dishes'],
	'cuisine': ['South Indian'],
    'totalTimeInMinutes': { min: 80, max: 100 },
    'vegan': false,
    'forChat': true
}

const filterIngredientsChatEvent = {
    'ingredients': 'eggplant, coconut and tamarind',
    'forChat': true
}

const whenLoadTestData = () => {
    const testData = JSON.parse(fs.readFileSync(path.join(__dirname, './testfiles/testdata.json')))
    const client = redis.createClient(process.env.CACHE_ENDPOINT)
    return client.flushdbAsync()
                .then(() => {
                    const trans = client.multi()
                    for (const key of _.keys(testData))
                    {
                        if (Array.isArray(testData[key])) {
                            for (const value of testData[key])
                            {
                                if (_.isObject(value)) {
                                    for (const id of _.keys(value))
                                        trans.zadd(key, value[id], id)
                                }
                                else
                                    trans.sadd(key, testData[key])
                            }
                        }
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
                    assert.deepEqual(results, ['3uDSc4Vg'])
                    return Promise.resolve()
                })    
                .then(() => index.whenHandler(filterChatEvent))
                .then(results => {
                    results.messages[0].attachment.payload.elements.sort((a, b) => a.title.localeCompare(b.title))
                    testMessages.push('Filter gallery')
                    assert.equal(results.messages[0].attachment.payload.elements.length, 1)                    
                    assert.deepEqual(results.messages[0].attachment.payload.elements[0], {
                        'title': 'Hyderabadi Vegetable Dum Biryani',
                        'subtitle': 'A slow-cooked fragrant and spicy rice dish, a legacy of the Nizam rule in Hyderabad in India',
                        'image_url':'https://res.cloudinary.com/recipe-shelf/image/upload/v1484217570/recipe-images/ip8GhIId.jpg',
                        'item_url':'https://www.recipeshelf.com.au/recipe/3uDSc4Vg/'
                    })
                    return Promise.resolve()
                })     
                .then(() => index.whenHandler(autocompleteEvent))
                .then(results => {
                    testMessages.push('Autocomplete recipe name')
                    assert.deepEqual(results, [{sentence: 'Eggplant in a Peanut-Sesame Gravy', id: 'NXkkUWRu'}])
                    return Promise.resolve()
                })
                .then(() => index.whenHandler(autocompleteChatEvent))
                .then(results => {
                    results.messages[0].attachment.payload.elements.sort((a, b) => a.title.localeCompare(b.title))
                    testMessages.push('Autocomplete gallery')
                    assert.equal(results.messages[0].attachment.payload.elements.length, 1)                    
                    assert.deepEqual(results.messages[0].attachment.payload.elements[0], {
                        'title':'Hyderabadi Bagara Baingan',
                        'subtitle': 'Fried eggplant in a rich peanut and sesame gravy, a legacy of the Nizam rule of Hyderabad in India',
                        'image_url':'https://res.cloudinary.com/recipe-shelf/image/upload/v1484217570/recipe-images/QjWTNJiJ.jpg',
                        'item_url':'https://www.recipeshelf.com.au/recipe/NXkkUWRu/'
                    })
                    return Promise.resolve()
                })
                .then(() => index.whenHandler(filterIngredientsChatEvent))
                .then(results => {
                    results.messages[0].attachment.payload.elements.sort((a, b) => a.title.localeCompare(b.title))
                    testMessages.push('Filter ingredients gallery')
                    assert.equal(results.messages[0].attachment.payload.elements.length, 1)                    
                    assert.deepEqual(results.messages[0].attachment.payload.elements[0], {
                        'title':'Hyderabadi Bagara Baingan',
                        'subtitle': 'Fried eggplant in a rich peanut and sesame gravy, a legacy of the Nizam rule of Hyderabad in India',
                        'image_url':'https://res.cloudinary.com/recipe-shelf/image/upload/v1484217570/recipe-images/QjWTNJiJ.jpg',
                        'item_url':'https://www.recipeshelf.com.au/recipe/NXkkUWRu/'
                    })
                    return Promise.resolve()
                })                
            )            

Promise.all(tests)
        .then(() => {
            console.info(_.map(testMessages, m => m + ' - passed').join('\n'))
            process.exit()
        })
        .catch(err => {
            console.error(err)
            process.exit()            
        })


