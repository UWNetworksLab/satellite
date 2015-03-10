/*jslint node:true,nomen:true */
'use strict';

var fs = require('fs');
var config = JSON.parse(fs.readFileSync(__dirname + '/../config.json'));

exports.getKey = function (key) {
  return config[key];
};

if (require.main === module) {
  console.log(exports.getKey(process.argv[2]));
}
