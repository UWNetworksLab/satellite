/*jslint node:true,nomen:true */
'use strict';

var fs = require('fs');
var config = JSON.parse(fs.readFileSync(__dirname + '/../config.json'));

exports.getKey = function (key) {
  return config[key];
};

if (require.main === module) {
  var key = exports.getKey(process.argv[2]);
  if (key !== undefined) {
    console.log(key);
  }
}
