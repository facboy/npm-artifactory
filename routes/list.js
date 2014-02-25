var request = require('request');
var http = require('http');
var path = require('path');
var url = require('url');
var _ = require('lodash');

module.exports = function(config) {
    var util = require('../lib/util')(config),
        createOption = util.createOption;

    var exports = {};

    /**
     * meta always attempts to check against the registry for a newer version.
     */
    exports.meta = function(req, res){
        var artPath = util.artMetaPath(req.params.packagename);
        request.head({uri: artPath, json: true}, function(err, metaRes) {
            if (!err && metaRes.statusCode !== 404) {
                request.get({uri: artPath, json: true}, function(err, artRes, body) {
                    // check whether meta has changed
                    var npmRequest = createOption(req);
                    if (body.etag) {
                        npmRequest.headers['If-None-Match'] = body.etag;
                    } else {
                        npmRequest.headers['If-Modified-Since'] = value.date;
                    }

                    getFromNpm(npmRequest, body.meta);
                });
            } else {
                getFromNpm();
            }

            function getFromNpm(npmRequest, currentMeta) {
                if (!npmRequest) {
                    npmRequest = createOption(req, {json: true});
                } else {
                    npmRequest.method = 'GET';
                    npmRequest.json = true;
                }

                var date = new Date();
                request.get(npmRequest, function(err, npmRes, body){
                    if (!err && npmRes.statusCode === 304){
                        res.send(npmRes.statusCode);
                    } else if (err || npmRes.statusCode !== 200) {
                        console.warn('GET %s %d err - %j', npmRequest.uri, getStatusCode(npmRes, -1), err);
                        if (currentMeta) {
                            sendMeta(currentMeta);
                        } else {
                            res.status(getStatusCode(npmRes, 500))
                                .send(body);
                        }
                    } else {
                        // store the etag, date and the metadata
                        var stored = {
                            meta: body,
                            date: npmRes.headers.date || date.toUTCString()
                        };
                        if (npmRes.headers.etag) {
                            stored.etag = npmRes.headers.etag;
                        }

                        // store the original data, and modify what we send back - this allows eg the npm-artifactory
                        // to change its location yet still use the same artifactory instance
                        // todo: just do the get with accepts: text/plain
                        request.put({uri: artPath, json: stored}, function(){
                            sendMeta(body);
                        });
                    }
                });
            }

            function sendMeta(meta) {
                fixMeta(meta);
                res.send(meta);
            }
        });
    };

    /**
     * Version always uses the metadata in artifactory, if it is available.  This way if for some reason
     * the version metadata is changed in the npm registry, we continue to return the original metadata in
     * artifactory.
     */
    exports.version = function(req, res){
        var versionPath = util.artifactPath({
            name: req.params.packagename,
            version: req.params.version,
            file: 'metadata.json'
        });
        request.head({uri: versionPath, json: true}, function(err, versionRes){
            if (!err && versionRes.statusCode !== 404) {
                request.get({uri: versionPath, json: true}, function(err, msg, body) {
                    sendVersion(body);
                });
            } else {
                var npmRequest = createOption(req, {json: true});
                request.get(npmRequest, function(err, npmRes, body){
                    if (err || npmRes.statusCode !== 200) {
                        console.warn('GET %s %d err - %j', npmRequest.uri, getStatusCode(npmRes, -1), err);
                        res.status(getStatusCode(npmRes, 500))
                            .send(body);
                    } else {
                        // store the original data, and modify what we send back - this allows eg the npm-artifactory
                        // to change its location yet still use the same artifactory instance
                        // todo: just do the GET with accepts: text/plain
                        request.put({uri: versionPath, json: body}, function(){
                            sendVersion(body);
                        });
                    }
                });
            }

            function sendVersion(version) {
                fixVersion(version);
                res.send(version);
            }
        });
    };

    exports.artifact = function(req, res){
        var filename = req.params.filename;
        var artPath = util.artifactPath({
            name: req.params.packagename,
            version: filename.replace(req.params.packagename, '').replace('.tgz', '').substr(1),
            file: req.params.filename
        });
        request.head({uri: artPath, json: true}, function(err, artifactRes){
            if (!err && artifactRes.statusCode !== 404) {
                request.get(artPath).pipe(res);
            } else {
                var npmRequest = {
                    uri: url.format(config.npm) + req.url,
                    encoding: null,
                    headers: {
                        Host: config.npm.host
                    }
                };
                request.get(npmRequest, function(err, npmRes, body) {
                    if (err || npmRes.statusCode !== 200) {
                        console.warn('GET %s %d err - %j', npmRequest.uri, getStatusCode(npmRes, -1), err);
                        res.send(getStatusCode(npmRes, 500));
                    } else {
                        request.put({uri: artPath, body: body}, function(){
                            res.send(body);
                        });
                    }
                });
            }
        });
    };

    var httpRegex,
        httpsRegex,
        proxyPath = 'http://' + config.host + ':' + config.port;
    (function() {
        var npmConfig = _.clone(config.npm);
        npmConfig.protocol = 'http';
        httpRegex = new RegExp('^' + url.format(npmConfig), 'g');
        npmConfig.protocol = 'https';
        httpsRegex = new RegExp('^' + url.format(npmConfig), 'g');
    })();

    function fixMeta(meta) {
        if (meta && meta.versions) {
            _.forEach(meta.versions, fixVersion);
        }
    }

    function fixVersion(version) {
        if (version.dist && version.dist.tarball) {
            version.dist.tarball = replaceNpmRegistryUrl(version.dist.tarball)
        }
    }

    function replaceNpmRegistryUrl(url) {
        url = url.replace(httpRegex, proxyPath);
        url = url.replace(httpsRegex, proxyPath);
        return url;
    }

    function getStatusCode(res, defaultStatusCode) {
        return (res && res.statusCode) || defaultStatusCode;
    }

    return exports;
};
