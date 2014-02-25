var path = require('path');
var url = require('url');
var _ = require('lodash');

module.exports = function(config) {
    var exports = {};

    exports.reverseDomain = function(domain){
        return domain.split('.').reverse().join('.');
    };
    exports.artifactPath = function(artifact){
        var artifactoryPath = url.format(config.artifactory);
        artifact.file = artifact.file || '';
        artifact.group = artifact.group || exports.reverseDomain(config.npm.host);
        return artifactoryPath + '/' + path.join(
            artifact.group.replace(/\./g,'/'),
            encodeURIComponent(artifact.name),
            encodeURIComponent(artifact.version),
            encodeURIComponent(artifact.file)
        );
    };
    exports.artMetaPath = function(artifactName){
        return exports.artifactPath({
            name: artifactName,
            version: '_meta',
            file: 'metadata.json'
        });
    };
    exports.createOption = function(req, opts) {
        // use deep clone on headers so we don't mess with the original req headers
        var options = {
            uri: url.format(config.npm) + req.url,
            json: req.body,
            headers: _.cloneDeep(req.headers)
        };

        if (config.proxy) options.proxy = config.proxy;
        if (config.timeout) options.timeout = config.timeout;
        options.headers.Host = config.npm.host;

        if (opts) {
            _.assign(options, opts);
        }

        return options;
    };

    return exports;
};
