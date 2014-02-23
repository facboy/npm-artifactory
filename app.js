var express = require('express')
  , http = require('http')
  , path = require('path')
  , cluster = require('cluster')
  , _ = require('lodash')
  , fs = require('fs')
  , config = loadConfig()
  , routes = require('./routes')(config);

cluster.on('exit', function(worker){
    console.log('Worker ' + worker.id + ' died');
    cluster.fork();
});

// if we're remote debugging, don't use cluster
if (!isDebug() && cluster.isMaster){
    var count = require('os').cpus().length;
    for (var i = 0; i < count; i++){
        cluster.fork();
    }
} else {
    var app = express();

    app.set('port', process.env.PORT || config.port || 3000);
    app.use(express.favicon());
    app.use(express.logger(config.logger || 'tiny'));
    app.use(express.methodOverride());
    app.use(app.router);

    if ('development' == app.get('env')) {
      app.use(express.errorHandler());
    }
    app.put('/-/user/org.couchdb.user:*', routes.user.add);
    app.get('/-/user/org.couchdb.user:*', routes.user.get);
    app.post('/_session', routes.user.login);

    app.get('/:packagename', routes.get.meta);
    app.get('/:packagename/:version', routes.get.version);
    app.get('/:packagename/-/:filename', routes.get.artifact);

    app.put('/:packagename', [express.bodyParser()], routes.publish.meta);
    app.put('/:packagename/-/:filename/-rev/:revision', routes.publish.artifact);
    app.put('/:packagename/:version/-tag/latest', [express.bodyParser()], routes.publish.tag);

    http.createServer(app).listen(app.get('port'), function(){
      console.log('Express server listening on port ' + app.get('port'));
    });
}

function loadConfig() {
    var opts = require('nopt')(
            {
                'config': [String]
            },
            {
                'c': ['--config']
            }),
        configFile = './config';

    if (opts.config) {
        configFile = (/\.\/|\.\.\//.test(opts.config) && opts.config) || './' + opts.config;
    }

    return require(configFile);
}

function isDebug() {
    return _.some(process.execArgv, function(arg) {
        return /^--debug/.test(arg);
    })
}
