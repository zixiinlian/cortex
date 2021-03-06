'use strict';

var server      = module.exports = {};

var express     = require('express');
var node_path   = require('path');
var app         = require('../service/app');

server.run = function(options, callback) {
    options.port = options.port || this.context.profile.get('service_port');

    startService('command', options);
    startService('kill', options);
    startService('static', options);
};


function startService(name, options){
    var opt = require( node_path.join(__dirname, '..', 'service', 'action', name) );

    if ( typeof opt === 'function' ) {
        opt = opt(options);
    }

    opt.port = options.port;

    app.create(opt);

    options.open && opt.open && opt.open('http://localhost:' + options.port);
}