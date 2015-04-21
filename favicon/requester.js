/*jslint node:true*/
'use strict';

/*
 * Handles a single request for a favicon, returns information from the request or what happened.
 */

var crypto = require('crypto');
var http = require('http');

var Q = require('q');

// Module Specific
var TIMEOUT = 10000; // 10 s timeout

/*
 * Gets the favicon for the given hostname, from the given ip
 * If everything goes well, returns the array of results.
 *
 * Content type is returned if the server specifies it.
 * If an error occurs, returns the error
 */
exports.getFavicon = function(ip, hostname, port) {
  var deferred = Q.defer();
  var req = http.request({
    host: ip,
    port: port,
    method: 'GET',
    path: '/favicon.ico',
    headers: { Host: hostname }
  });

  req.on('response', function(res) { // Called once
    var length = 0;
    var hashsum = crypto.createHash('md5');
    res.on('data', function(data) {
      length += data.length;
      hashsum.update(data);
    });
    res.on('end', function() {
      var hash = hashsum.digest('hex');
      var result = {
        hash: hash,
        length: length,
        status: res.statusCode,
      };
      if (res.headers['content-type']) {
        result.type = res.headers['content-type'];
      }
      deferred.resolve(result);
    });
  });

  req.on('error', function(err) {
    // Timeout/TCP/HTTP-parse errors here
    deferred.reject(err);
  });

  req.end();
  return deferred.promise;
};



/*
TODO: Remove test code
var success = function(success) {
  console.log("success:");
  console.log(success);
};
var error = function(error) {
  console.log("error:");
  console.log(error);
};

exports.t1 = function() {
  exports.getFavicon('127.0.0.1', 'www.google.com', 1234).then(success,error);
};


exports.t2 = function() {
  exports.getFavicon('216.58.216.142', 'www.google.com', 80).then(success,error);
};

exports.t3 = function() {
  exports.getFavicon('2.5.2.1', 'www.google.com', 80).then(success,error);
};

*/
