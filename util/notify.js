var email = require('emailjs');
var config = require('./config');

var server = email.server.connect(config.getKey('notification_server'));

if (process.argv[2] && process.argv[2] == "done") {
  server.send(config.getKey('finished_email'), function (err, msg) {
    'use strict';
    if (err) {
      console.error(err);
      process.exit(1);
    }
  });
  return;
}

server.send(config.getKey('notification_email'), function (err, msg) {
  'use strict';
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
