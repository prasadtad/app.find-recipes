// cache/find-recipes.js

const _ = require('lodash')
const RedisPoco = require('redis-poco')
const RedisPhraseComplete = require('redis-phrase-complete')

module.exports = class FindRecipes
{
    constructor(whenIngredients)
    {        
        this.redisPoco = new RedisPoco({ namespace: 'recipe', itemKey: 'item', endpoint: process.env.CACHE_ENDPOINT, attributes: [ 'vegan', 'totalTimeInMinutes', 'approved', 'spiceLevel', 'region', 'cuisine', 'chefId', 'ingredientIds', 'overnightPreparation', 'accompanimentIds', 'collections' ]})
        this.whenIngredients = whenIngredients
        this.redisPhraseComplete = new RedisPhraseComplete({ namespace: 'recipe:autocomplete', client: this.redisPoco.client })
        _.bindAll(this, 'whenAutocompleteIngredients', 'whenFilter', 'whenFind', 'whenQuit')
    }

    whenAutocompleteIngredients() 
    {
        if (!this.ingredientsPhraseComplete) 
            this.ingredientsPhraseComplete = new RedisPhraseComplete({ namespace: 'ingredient:autocomplete', client: this.redisPoco.client })
        const p = this.ingredients ? Promise.resolve(this.ingredients) : this.whenIngredients
        return p.then(ingredients => this.ingredientsPhraseComplete.whenRemoveAll()
                    .then(() => {
                        const whenAddAllSentences = _.flatMap(ingredients, ingredient => 
                                                        _.map(ingredient.names, name => 
                                                            this.ingredientsPhraseComplete.whenAdd(name, ingredient.id)))
                        return Promise.all(whenAddAllSentences)
                    }))                    
    }

    whenFilter(filter)
    {
        filter.approved = true
        if (!filter.ingredients)
            return this.redisPoco.whenFilter(filter)
        return this.whenAutocompleteIngredients()
                    .then(() => 
            Promise.all(_.map(filter.ingredients.split(/,|and/g), ingredient => 
                            this.ingredientsPhraseComplete.whenFind(_.trim(ingredient))))
                .then(allResults => {
                    allResults = _.flatten(allResults)
                    filter.ingredientIds = _.map(allResults, result => result.id)
                    return this.redisPoco.whenFilter(filter)                
                }))
    }    

    whenFind(searchPhrase) 
    {
        return this.redisPhraseComplete.whenFind(searchPhrase)         
    }

    whenGetRecipe(id)
    {
        return this.redisPoco.whenGet(id)
    }

    whenQuit()
    {
        return this.redisPoco.whenQuit()
    }
}