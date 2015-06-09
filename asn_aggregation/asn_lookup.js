/*jslint bitwise:true*/
'use strict';

/**
 * getMap(optional rip json) -> Promise(<map>)
 * with a lookup function.
 * generates current origin as if no json provided.
 */
var Q = require('q');
var fs = require('fs');
var es = require('event-stream');
var chalk = require('chalk');
var sys = require('sys');
var exec = require('child_process').exec;
var ip_utils = require('../util/ip_utils');


// actually: http://archive.routeviews.org/dnszones/originas.bz2
// but domain defaults to broken ipv6 resolution.
var as_file = "http://128.223.51.20/dnszones/originas.bz2";

function fetchOriginAS () {
  console.log(chalk.blue('Refreshing OriginAS List'));
  return Q.Promise(function (resolve, reject) {
    exec('curl ' + as_file + ' | bunzip2 > originas', function (error) {
      if (error) {
        reject(new Error(error));
      } else {
        console.log(chalk.green('Done.'));
        resolve();
      }
    });
  });
}

// Take a line of the origin AS file and load it into a hash map.
// Map format is {start -> {cidr -> asn}}
var parseASLineRegex = /IN TXT\s+"(\d+)" "(\d+\.\d+\.\d+\.\d+)" "(\d+)"/;
function parseASLine(map, line) {
  var result = parseASLineRegex.exec(line),
      start;
  if (result) {
    start = new Buffer(result[2].split('.')).readInt32BE(0);
    start -= start % 256;  // make sure it's class C.
    if (!map[start]) {
      map[start] = {};
    }
    map[start][parseInt(result[3])] = parseInt(result[1]);
  }
}



function doASLookup(ip, off) {
  if (!ip) {
    return 'unknown';
  }
  if (!off) {
    off = 0;
  }
  var classC;
  if (typeof ip === 'string') {
    var bytes = ip.split('.');
    if (bytes.length < 4) {
      return 'unknown';
    }
    classC = new Buffer(bytes).readInt32BE(0);
    classC -= classC % 256;
  } else {
    classC = ip;
  }
  while (off < 16) {
    if (this[classC]) {
      var keys = Object.keys(this[classC]);
      for (var i = 24 - off; i > 8; i--) {
        if (keys.indexOf('' + i) >= 0) {
          return this[classC]['' + i];
        }
      }
    }
    off += 1;
    classC -= classC % (256 << (off));
  }
  return 'unknown';
}

// Build the in memory representation of the origin ip->asn mapping.
// Returns promise with that map.
function makeASMap() {
  console.log(chalk.blue("Building ASN Mapping"));
  var map = {};
  map.lookup = doASLookup;
  return Q.Promise(function(resolve, reject) {
    fs.createReadStream("originas", {flags: 'r'})
      .pipe(es.split())  //split on new lines
      .pipe(es.mapSync(parseASLine.bind({}, map)))
      .on('end', function() {
        console.log(chalk.green('Done.'));
        resolve(map);
      })
      .on('error', function(err) { reject('Error Building ASN Mapping' + err); });
  });
}

function loadASMap(mapFile) {
  var prom = new Q(0);
  if (mapFile && fs.existsSync(mapFile)) {
    prom = prom.then(function() {
      var map = JSON.parse(fs.readFileSync(mapFile));
      map.lookup = require('ip2country').lookup.bind({}, map);
      map.classC = ip_utils.getClassC;
      return map;
    });
  } else if (!fs.existsSync('asmap.json') ||
      new Date() - fs.statSync('asmap.json').mtime > (1000 * 60 * 60 * 24 * 30)) {
        prom = prom.then(fetchOriginAS).then(makeASMap).then(function(map) {
          var lu = map.lookup;
          delete map.lookup;
          fs.writeFileSync("asmap.json", JSON.stringify(map));
          map.lookup = lu;
          map.classC = ip_utils.getClassC;
          return map;
        });
  } else {
    prom = prom.then(function() {
      var map = JSON.parse(fs.readFileSync("asmap.json"));
      map.lookup = doASLookup;
      map.classC = ip_utils.getClassC;
      return map;
    });
  }
  return prom;
}

exports.getMap = loadASMap;
