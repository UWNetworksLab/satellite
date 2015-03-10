/*jslint node:true*/
'use strict';

//Usage: node makemap.js 12-14-2014 runs/

var fs = require('fs');

var when = process.argv[2];
var where = process.argv[3];
require('ip2country/src/build').getGenericMap(false, false, when).then(function (map) {
  fs.writeFileSync(where + '/' + when + '.lookup.json', JSON.stringify(map));
  fs.unlinkSync('rib');
  process.exit(0);
});

