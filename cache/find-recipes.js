// cache/find-recipes.js

const _ = require('lodash')
require('lodash.product')

const RedisPoco = require('redis-poco')
const RedisPhraseComplete = require('redis-phrase-complete')

module.exports = class FindRecipes
{
    constructor(memoryCache)
    {        
        this.memoryCache = memoryCache
        this.redisPoco = new RedisPoco({ namespace: 'recipe', itemKey: 'item', endpoint: process.env.CACHE_ENDPOINT, attributes: [ 'vegan', 'totalTimeInMinutes', 'approved', 'spiceLevel', 'region', 'cuisine', 'chefId', 'ingredientIds', 'overnightPreparation', 'accompanimentIds', 'collections' ]})
        this.redisPhraseComplete = new RedisPhraseComplete({ namespace: 'recipe:autocomplete', client: this.redisPoco.client })
        this.ingredientsPhraseComplete = new RedisPhraseComplete({ namespace: 'ingredient:autocomplete', client: this.redisPoco.client })

        _.bindAll(this, 'whenFilter', 'whenFind', 'whenQuit')
    }

    whenFilter(filter, filterJson)
    {
        if (this.memoryCache.hasOwnProperty(filterJson))
            return this.memoryCache[filterJson]

        filter.approved = true
        let whenResult
        if (!filter.ingredients) {
            whenResult = this.redisPoco.whenFilter(filter)
            this.memoryCache[filterJson] = whenResult
            return whenResult
        }

        const whenFindIngredients = Promise.all(_.map(filter.ingredients.split(/,|and/g), ingredient => 
                                                this.ingredientsPhraseComplete.whenFind(_.trim(ingredient))))
        whenResult = whenFindIngredients
            .then(allResults => {
                allResults = _.product(..._.map(allResults, results => _.uniq(_.map(results, result => result.id))))
                
                return Promise.all(_.map(allResults, allResult => {
                    const filterWithIngredientIds = _.cloneDeep(filter)
                    filterWithIngredientIds.ingredientIds = allResult
                    return this.redisPoco.whenFilter(filterWithIngredientIds)
                })).then(results => Promise.resolve(_.concat(...results)))                
        })

        this.memoryCache[filterJson] = whenResult
        return whenResult
    }

    whenFind(searchPhrase) 
    {
        if (this.memoryCache.hasOwnProperty(searchPhrase))
            return this.memoryCache[searchPhrase]

        const whenResult = this.redisPhraseComplete.whenFind(searchPhrase)         
        this.memoryCache[searchPhrase] = whenResult
        return whenResult
    }

    whenGetRecipe(id)
    {
        if (this.memoryCache.hasOwnProperty(id))
            return this.memoryCache['Recipe' + id]

        const whenResult = this.redisPoco.whenGet(id)
        this.memoryCache['Recipe' + id] = whenResult
        return whenResult
    }

    whenQuit()
    {
        return this.redisPoco.whenQuit()
    }
}