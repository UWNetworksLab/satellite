/*jslint node:true*/
'use strict';

/*
 * StatusCodes
 * Error codes that can happen when making requests for favicons.
 */
var sc;
exports.STATUS_CODES = sc = {
  TIMEOUT: -1,
  CONNECT_REFUSED: -2,
  CONNECTION_RESET: -3,
  INVALID_HTTP: -4
};

exports.CODE_DESCRIPTIONS = {
  TIMEOUT: 'Could not connect to the server',
  CONNECT_REFUSED: 'Server refused the connection',
  CONNECTION_RESET: 'Connection was reset by peer',
  INVALID_HTTP: 'Response is not valid HTTP'
};
