
var messages = require('./messages');
var status   = require('./status');
var Promise  = require('promise-polyfill');
var setAsap  = require('setasap');
    Promise._setImmediateFn(setAsap);


var buildUrl = function(config){
    "use strict";
    
    // Prevent XSS
    Object.assign(config, {
        root: window.location.href
    });

    // Setup
    var url    = [config.root];
    var prefix = config.target.substring(0,1);

    // Build url
    switch(prefix){
        case '/':
            url.push(config.target.replace('/', ''));
            break;
        case './':
            url.push(config.target.replace('./', ''));
            break;
        case 'h':
            throw new Error(messages.error.xssForbidden);
            break;
        default:
            url.push(config.modules.split('/').join('') + '/');
            url.push(config.target + '/');
            url.push(config.main);
    }

    return url.join('');

};


var request = function(config){
    "use strict";

    // Setup
    var req    = new XMLHttpRequest();
    var method = 'GET';
    var url    = encodeURI(buildUrl(config));

    // Open sync connection
    req.open(method, url);

    return new Promise(function(resolve, reject){

        // Register load handler
        req.addEventListener("load", function(){
            resolve({
                status: req.status,
                response: req.responseText
            });
        });

        // Run request
        req.send(null);

        // Setup timeout
        setTimeout(function(){
            var error = new Error('Estupendo ERROR: Async request worker timed out');
            reject(error);
        }, config.timeout);
    });
};

var response = function(res){
    "use strict";

    // Config shorthand
    var config = this;

    // Try again
    if( config.force && 404 == res.status && 'package.json' !== config.main ){

        // Warning
        console.info('TIP: Setup a module alias to avoid loading package.json');

        // Get package.json
        config.main = 'package.json';

        // Run request
        return request(config)
            .then(response.bind(config))
            .then(function(pkg){
                
                // Is main defined?
                if( !('main' in pkg) )
                    throw new Error(messages.error.noMain);

                // Update config
                config.main = pkg.main;

                // Run new request
                return request(config).then(response.bind(config));
        });
    }

    return status[res.status].call(config, res.response);

};

var transport = module.exports = function(target){
    "use strict";

    // Setup config
    var config = Object.assign({}, window.estupendo.config, {
        target: target,
        main:   'index.js'
    });

    // Check for target aliases
    if( config.alias && target in config.alias ){

        // Get the alias
        var alias   = config.alias[target];

        // Remove leading slash
        if('/' === alias[0])
            alias = alias.substr(1);

        // Set main to alias
        config.main = alias;
    }


    // Run In Web Worker
    return request(config).then(response.bind(config));
};