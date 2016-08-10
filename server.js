'use strict';

var StaticServer = require('static-server');

var server = new StaticServer({
  rootPath: '.', 
  name: 'imgcache.js', 
  port: process.env.PORT || 8090, 
  cors: '*'
});
 
server.start(function () {
  console.log('Go to: http://127.0.0.1:' + server.port);
});
