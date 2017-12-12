// index.js

const _ = require('lodash')

const FindRecipes = require('./cache/find-recipes')

const whenQuit = (findRecipes, err) => findRecipes.whenQuit().then(() => Promise.reject(err))

exports.whenHandler = (event) => {
    if (!event) return Promise.reject(new Error('Invalid event - ' + JSON.stringify(event)))        
    if (!_.isObject(event)) return Promise.reject(new Error('Invalid event - ' + JSON.stringify(event)))        
    console.info(JSON.stringify(event))
    const findRecipes = new FindRecipes()
    try
    {
        let p;
        if (event.name)
            p = findRecipes.whenFind(event.name)
        else
            p = findRecipes.whenFilter(event)
        return p.then(results => findRecipes.whenQuit()
                                                .then(() => Promise.resolve(results)))
                .catch(err => whenQuit(findRecipes, err))
    }
    catch (err)
    {
        return whenQuit(findRecipes, err)
    }
}

exports.handler = (event, context, callback) => {
    exports.whenHandler(event)
            .then(result => callback(null, result))
            .catch(err => callback(err))    
}