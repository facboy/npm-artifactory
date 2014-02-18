module.exports = function(config) {
    return {
        get: require('./list')(config),
        publish: require('./publish')(config),
        user: require('./user')(config)
    };
}
