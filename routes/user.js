var url = require('url');
var request = require('request');

module.exports = function(config) {
    var createOption = require('../lib/util')(config).createOption;

    return {
        add: function(req, res){
            req.pipe(request.put(createOption(req))).pipe(res);
        },
        get: function(req, res){
            req.pipe(request.get(createOption(req))).pipe(res);
        },
        login: function(req, res){
            req.pipe(request.post(createOption(req))).pipe(res);
        }
    };
};
