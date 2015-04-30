/*jslint node:true*/
'use strict';

/*
 * Handles a single request for a favicon, returns information from the request or what happened.
 */

var crypto = require('crypto');
var http = require('http');
var https = require('https');
var url = require('url');

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
  getFaviconHttp(ip, hostname, port, deferred);
  return deferred.promise;
};

function getFaviconHttp(ip, hostname, port, deferred) {
  var req = http.request(getArgs(ip, hostname, port));

  req.on('response', function(res) {
    if (res.statusCode === 302 &&
        res.headers.location &&
        sameDomain(hostname, res.headers.location)) {
      // Follow https redirect
      req.abort();
      getFaviconHttps(ip, hostname, 443, deferred);
    } else {
      buildResult(res, deferred.resolve);
    }
  });
  attachErrorHandlers(req, deferred);
  req.end();
}

function getFaviconHttps(ip, hostname, port, deferred) {
  var options = getArgs(ip, hostname, port);
  options.rejectUnauthorized = false;
  var req = https.request(options);

  req.on('response', function(res) {
    buildResult(res, deferred.resolve);
  });
  attachErrorHandlers(req, deferred);
  req.end();
}

function attachErrorHandlers(req, deferred) {
  var result;
  req.on('error', reqErrHandler);
  req.setTimeout(TIMEOUT, function() {
    req.abort();
    errfcn(sc.STATUS_CODES.TIMEOUT);
  });
  function errfcn(code) {
    if (!result) {
      result = [
        code
      ];
      deferred.resolve(result);
    }
  }
  function reqErrHandler(err) {
    req.abort();
    if (err.code === 'ECONNREFUSED') {
      errfcn(sc.STATUS_CODES.CONNECT_REFUSED);
    } else if (err.code === 'ECONNRESET') {
      errfcn(sc.STATUS_CODES.CONNECTION_RESET);
    } else if (err.code.substring(0, 3) === 'HPE') {
      errfcn(sc.STATUS_CODES.INVALID_HTTP);
    } else if (err.code === 'ETIMEOUT') {
      errfcn(sc.STATUS_CODES.TIMEOUT);
    } else {
      errfcn(sc.STATUS_CODES.OTHER_ERROR);
    }
  }
}

function getArgs(ip, hostname, port) {
  return {
    host: ip,
    port: port,
    method: 'GET',
    path: '/favicon.ico',
    headers: { Host: hostname },
    agent:false
  };
}

function buildResult(res, callback) {
  var length = 0;
  var hashsum = crypto.createHash('md5');
  res.on('data', function(data) {
    length += data.length;
    hashsum.update(data);
  });
  res.on('end', function() {
    var hash = hashsum.digest('hex');
    var result = [
      res.statusCode,
      length,
      hash,
    ];
    if (res.headers['content-type']) {
      result.push(res.headers['content-type']);
    }
    res.socket.destroy();
    callback(result);
  });
}

function sameDomain(original, destination) {
  var parsed = url.parse(destination);
  var newHost = parsed.host || parsed.hostname;
  return newHost === original;
}

