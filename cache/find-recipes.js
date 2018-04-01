// cache/find-recipes.js

const _ = require('lodash')
require('lodash.product')

const RedisPoco = require('redis-poco')
const RedisPhraseComplete = require('redis-phrase-complete')

module.exports = class FindRecipes
{
    constructor()
    {        
        this.redisPoco = new RedisPoco({ namespace: 'recipe', itemKey: 'item', endpoint: process.env.CACHE_ENDPOINT, attributes: [ 'vegan', 'totalTimeInMinutes', 'approved', 'spiceLevel', 'region', 'cuisine', 'chefId', 'ingredientIds', 'overnightPreparation', 'accompanimentIds', 'collections' ]})
        this.redisPhraseComplete = new RedisPhraseComplete({ namespace: 'recipe:autocomplete', client: this.redisPoco.client })
        this.ingredientsPhraseComplete = new RedisPhraseComplete({ namespace: 'ingredient:autocomplete', client: this.redisPoco.client })

        _.bindAll(this, 'whenFilter', 'whenFind', 'whenQuit')
    }

    whenFilter(filter)
    {
        filter.approved = true
        if (!filter.ingredients)
            return this.redisPoco.whenFilter(filter)
        const whenFindIngredients = Promise.all(_.map(filter.ingredients.split(/,|and/g), ingredient => 
                                                this.ingredientsPhraseComplete.whenFind(_.trim(ingredient))))
        return whenFindIngredients
            .then(allResults => {
                allResults = _.product(..._.map(allResults, results => _.uniq(_.map(results, result => result.id))))
                
                return Promise.all(_.map(allResults, allResult => {
                    const filterWithIngredientIds = _.cloneDeep(filter)
                    filterWithIngredientIds.ingredientIds = allResult
                    return this.redisPoco.whenFilter(filterWithIngredientIds)
                })).then(results => Promise.resolve(_.concat(...results)))                
        })
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