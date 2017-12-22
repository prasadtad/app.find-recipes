// cache/find-recipes.js

const _ = require('lodash')
const RedisPoco = require('redis-poco')
const RedisPhraseComplete = require('redis-phrase-complete')

module.exports = class FindRecipes
{
    constructor()
    {        
        this.redisPoco = new RedisPoco({ namespace: 'recipe', itemKey: 'item', endpoint: process.env.CACHE_ENDPOINT, attributes: [ 'vegan', 'totalTimeInMinutes', 'approved', 'spiceLevel', 'region', 'cuisine', 'chefId', 'ingredientIds', 'overnightPreparation', 'accompanimentIds', 'collections' ]})
        this.redisPhraseComplete = new RedisPhraseComplete({ namespace: 'recipe:autocomplete', client: this.redisPoco.client })
        _.bindAll(this, 'whenFilter', 'whenFind', 'whenQuit')
    }

    whenFilter(filter)
    {
        filter.approved = true
        return this.redisPoco.whenFilter(filter)
    }

    whenFind(searchPhrase) 
    {
        return this.redisPhraseComplete.whenFind(searchPhrase)
                    .then(ids => Promise.all(_.map(ids, this.redisPoco.whenGet))
                                .then(allRecipes => {
                                    const results = []
                                    for (let i=0; i<ids.length; i++)
                                    {
                                        if (allRecipes[i].approved) {
                                            const name = _.find(allRecipes[i].names, name => name.toLowerCase().replace(/[(),!\\.-]+/g,' ').includes(searchPhrase))
                                            results.push({name: name, id: ids[i]})
                                        }
                                    }
                                    return Promise.resolve(results)
                                }))                    
    }

    whenQuit()
    {
        return this.redisPoco.whenQuit()
    }
}