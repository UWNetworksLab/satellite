/*jslint node:true*/
'use strict';

/*
 * Handles a single request for a favicon, returns information from the request or what happened.
 */

var crypto = require('crypto');
var http = require('http');

var Q = require('q');
var sc = require('./statuscodes.js');

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
  var result;
  var req = http.request({
    host: ip,
    port: port,
    method: 'GET',
    path: '/favicon.ico',
    headers: { Host: hostname }
  });

  req.on('response', function(res) { // Called once
    //TODO 302 responses - follow https redirects if in the same domain, ignore certificate failures
    var length = 0;
    var hashsum = crypto.createHash('md5');
    res.on('data', function(data) {
      length += data.length;
      hashsum.update(data);
    });
    res.on('end', function() {
      var hash = hashsum.digest('hex');
      result = [
        res.statusCode,
        length,
        hash,
      ];
      if (res.headers['content-type']) {
        result.push(res.headers['content-type']);
      }
      deferred.resolve(result);
    });
  });

  function errfcn(code) {
    if (!result) {
      result = [
        code
      ];
      deferred.resolve(result);
    }
  }
  req.on('error', function (err) {
    req.abort();
    // Timeout/TCP/HTTP-parse errors here
    if (err.code === 'ECONNREFUSED') {
      errfcn(sc.STATUS_CODES.CONNECT_REFUSED);
    } else if (err.code === 'ECONNRESET') {
      errfcn(sc.STATUS_CODES.CONNECTION_RESET);
    } else if (err.code.substring(0, 3) === 'HPE') {
      errfcn(sc.STATUS_CODES.INVALID_HTTP);
    } else if (err.code === 'ETIMEOUT') {
      errfcn(sc.STATUS_CODES.TIMEOUT);
    } else {
      deferred.reject({
        status: "unknown error",
        err: err
      });
    }
  });
  req.setTimeout(TIMEOUT, function() {
    req.abort();
    errfcn(sc.STATUS_CODES.TIMEOUT);
  });

  req.end();
  return deferred.promise;
};

