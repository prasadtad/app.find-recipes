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
        return p.then(results => event.forChat ? whenChatGallery(findRecipes, results) : Promise.resolve(results))
                .then(results => findRecipes.whenQuit()
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

const whenChatGallery = (findRecipes, results) => {
    const message = {
              'attachment':{
                'type':'template',
                'payload':{
                  'template_type':'generic',
                  'elements':[]
                }
              }
            }
    const whenGetRecipes = _.map(_.take(results, 10), result => findRecipes.whenGetRecipe(_.isString(result) ? result : result.id))
    return Promise.all(whenGetRecipes)
                  .then(recipes => {
                      message.attachment.payload.elements.push(..._.map(recipes, recipe => {
                        return {
                        'title': recipe.names[0],
                        "subtitle": recipe.description,
                        'image_url':'https://res.cloudinary.com/recipe-shelf/image/upload/v1484217570/recipe-images/' + recipe.imageId + '.jpg',
                        'item_url':'https://www.recipeshelf.com.au/recipe/' + recipe.id + '/'
                        }}))
                    return Promise.resolve({ 'messages' : [ message ] })
                  })
}