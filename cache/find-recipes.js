// cache/find-recipes.js

const RecipeKeys = require('./recipe-keys')
const _ = require('lodash')
const RedisProxy = require('../proxies/redis-proxy')
const RedisPhraseComplete = require('redis-phrase-complete')

module.exports = class FindRecipes
{
    constructor()
    {        
        this.redisProxyClient = new RedisProxy.Client()
        this.keys = new RecipeKeys(this.redisProxyClient.seperator)
        this.redisPhraseComplete = new RedisPhraseComplete({ client: this.redisProxyClient.client, namespace: this.keys.Autocomplete })
        _.bindAll(this, 'buildKey', 'whenFilter', 'whenFind', 'whenQuit')
    }
    
    buildKey(setPrefix, flag) 
    {
        return setPrefix + this.redisProxyClient.seperator + (flag ? 'True' : 'False')
    }

    whenFilter(filter)
    {
        const keyPromises = [];
        if (filter.ingredientIds && filter.ingredientIds.length > 0)
            keyPromises.push(this.redisProxyClient.whenSetOr(this.keys.IngredientId, filter.ingredientIds));
        if (filter.regions && filter.regions.length > 0) 
            keyPromises.push(this.redisProxyClient.whenSetOr(this.keys.Region, filter.regions));
        if (filter.cuisines && filter.cuisines.length > 0) 
            keyPromises.push(this.redisProxyClient.whenSetOr(this.keys.Cuisine, filter.cuisines));
        if (filter.spiceLevels && filter.spiceLevels.length > 0) 
            keyPromises.push(this.redisProxyClient.whenSetOr(this.keys.SpiceLevel, filter.spiceLevels));
        if (filter.totalTimes && filter.totalTimes.length > 0) 
            keyPromises.push(this.redisProxyClient.whenSetOr(this.keys.TotalTime, filter.totalTimes));
        if (filter.collections && filter.collections.length > 0) 
            keyPromises.push(this.redisProxyClient.whenSetOr(this.keys.Collection, filter.collections));
        const keys = [];
        if (filter.vegan) keys.push(this.buildKey(this.keys.Vegan, filter.vegan))
        if (filter.overnightPreparation) keys.push(this.buildKey(this.keys.OvernightPreparation, filter.overnightPreparation))
        if (keyPromises.length == 0 && keys.length == 0) return Promise.resolve([])
        return Promise.all(keyPromises)
                    .then(k => this.redisProxyClient.whenSetsAnd(_.union(k, keys)))
                    .then(setKey => this.redisProxyClient.whenMembers(setKey))
    }

    whenFind(searchPhrase) 
    {
        return this.redisPhraseComplete.whenFind(searchPhrase)
                    .then(ids => Promise.all(_.map(ids, id => this.redisProxyClient.whenGet(this.keys.Names, id)))
                                    .then(allNames => {
                                        const results = []
                                        for (let i=0; i<ids.length; i++)
                                        {
                                            const name = _.find(allNames[i].split('\n'), name => name.toLowerCase().includes(searchPhrase))
                                            results.push({name: name, id: ids[i]})
                                        }
                                        return Promise.resolve(results)
                                    }))                    
    }

    whenQuit()
    {
        return this.redisProxyClient.whenQuit()
    }
}