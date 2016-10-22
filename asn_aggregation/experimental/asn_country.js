'use strict';

/*
 * Set of exported functions for merging asn counts to country counts.
 * Common usage is to get a fresh ASN->Country lookup table, which can be
 * accomplished through the slightly awkward:
 * ```javascript
 * var country_lookup = require('asn_country');
 * country_lookup.onReady().then(function () {
 *   var lookup_table = country_lookup.db;
 * });
 * ```
 * No caching is done - that's up to the consumer.
 */
var Q = require('q');

var regex = /\d+.*AS(\d+).*,([A-Z]{2})/;
var makeDB = function(page) {
  var lines = page.split('\n');
  var db = {};
  for (var i = 0; i < lines.length; i+=1) {
    var out = regex.exec(lines[i]);
    if (out) {
      db[out[1]] = out[2];
    }
  }
  return db;
};

var http = require('http');
var load = function(cb) {
  var url = "http://www.cidr-report.org/as2.0/bgp-originas.html";
  http.get(url, function(res) {
    var data = '';
    res.on('data', function (chunk) {
      data += chunk.toString();
    });
    res.on('end', function () {
      exports.db = makeDB(data);
      console.log('db done');
      cb();
    });
  });
};

exports.onReady = new Q.Promise(function (resolve,reject) {
  load(resolve);
});



exports.general2country = function(inmap,start,reduce) {
  var out = {};
  Object.keys(inmap).forEach(function(key) {
    var c = exports.db[key];
    if (c) {
      if(!out[c]){
        out[c]=start;
      }
      out[c] = reduce(out[c], inmap[key]);
    }
  });
  return out;
};

exports.asnmap2country = function(inmap) {
  return exports.general2country(inmap, 0, function(a,b) {return a+b;});
};

exports.goodbad2country = function(inmap) {
  return exports.general2country(inmap, [0,0,0], function(a,b) {return [a[0]+b[0],a[1]+b[1],b[2]];});
};


exports.listWeirdCases = function(base, test) {
  Object.keys(base).forEach(function(coun) {
    if (!test[coun]) {
      console.warn(base[coun] + ':0 ' + coun);
    } else if(2*test[coun] < base[coun]) {
      console.warn(base[coun] +': ' + test[coun] + ' ' +coun);
    }
  });
};
