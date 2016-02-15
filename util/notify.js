var email = require('emailjs');
var config = require('./config');

var server = email.server.connect(config.getKey('notification_server'));

server.send(config.getKey('notification_email'), function (err, msg) {
  'use strict';
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
