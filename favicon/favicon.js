/*jslint node:true*/
'use strict';

/*
 * Makes requests for favicons and records the results.
 * Requests the favicon for the Host as domain, from the ip addresses.
 *
 * Input file (json) maps domains to array of ip addresses.
 * Output file (json) maps domains to objects which map ips to results.
 *  results is an array of
 *  [http-status-code, content-length, favicon-hash, http-content-type]
 *   *                 **              **            ***
 *
 *  * Always present, either negative (see error codes below) or one of http codes
 *  ** Present if the response was valid http
 *  *** Present if response was valid http and has the header set.
 *
 * Usage
 *  node <favicons.js path> <SourceFile> <OutputFile>
 *
 *  * SourceFile should contain mappings of ip to a list of hostnames
 *  * OutputFile will contain a mapping of ip to another mapping of hostname to result
 */

var http = require('http');
var fs = require('fs');
var async = require('async');
var Q = require('q');
var es = require('event-stream');
var mapConcurrent = require('map-stream-concurrent');
var requester = require('./requester.js');
var progress = require('progressbar-stream');

var CONCURRENT_IPS = 200;

http.globalAgent.maxSockets = 10000;
if (process.argv.length !== 5) {
  console.log('Usage:\n\tnode <favicon.js> <ip-domains> <domain-hash> <OutputFile>');
  process.exit(1);
}
var infile = JSON.parse(fs.readFileSync(process.argv[2]));
var hashes = JSON.parse(fs.readFileSync(process.argv[3]));
var outFile = fs.createWriteStream(process.argv[4]);
console.log('Files loaded in memory');

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}


var ips = Object.keys(infile);
ips = shuffle(ips);
es.from(ips).pipe(progress({total: 15 * ips.length})).pipe(mapConcurrent(CONCURRENT_IPS, processIP)).pipe(es.join('\n')).pipe(outFile);

function processIP(ip, callback) {
  var hosts = Object.keys(infile[ip]);
  if (!hosts) {
    return callback();
  }
  hosts = hosts.filter(function (host) {
    return hashes[host] !== undefined;
  });
  if (hosts.length === 0) {
    return callback();
  }

  var state = {
    ip: ip.toString(),
    hosts: hosts,
    good: true,
    lastresult: null,
    callback: callback,
    output: {}
  };

  state.onFavicon = function (state, ipresult) {
    state.output[state.host] = ipresult;
    state.lastresult = ipresult;
    if (state.hosts.length === 0) {
      delete state.onFavicon;
      delete state.next;
      state.callback(JSON.stringify([state.ip, state.output]));
    } else {
      if (ipresult[0] < 0) {
        // Bad result, don't keep trying
        state.good = false;
        setTimeout(state.next, 0);
      } else {
        setTimeout(state.next, 1000);
      }
    }
  }.bind({}, state);

  state.next = function(state) {
    if (state.good && state.hosts.length) {
      state.host = state.hosts.shift();
      try {
      requester.getFavicon(state.ip, state.host, 80).then(state.onFavicon, function (error) {
        console.warn(error);
        setTimeout(state.next, 1000);
      });
      } catch (e) {
        console.error(e);
      }
    } else {
      while (state.hosts.length > 0) {
        state.host = state.hosts.shift();
        state.output[state.host] = state.lastresult;
      }
      delete state.onFavicon;
      delete state.next;
      state.callback(JSON.stringify([state.ip, state.output]));
    }
  }.bind({}, state);

  state.next();
}

process.on('uncaughtException', function (err) {
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
});
