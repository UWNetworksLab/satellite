/*jslint node:true */
'use strict';

var getPrefix = require('ip2country').prefix;

exports.getClassC = function (ip) {
  return getPrefix(ip, 24);
};

exports.isReserved = function (ip) {
  // http://en.wikipedia.org/wiki/Reserved_IP_addresses
  var fours = [3758096384, 4026531840],
    eights = [0, 167772160, 2130706432],
    tens = [1681915904],
    twelves = [2886729728],
    fifteens = [3323068416],
    sixteens = [2851995648, 3232235520],
    twentyfours = [3232235520, 3232236032, 3227017984, 3325256704, 3405803776],
    thirtytwos = [4294967295],
    prefix;

  prefix = getPrefix(ip, 32);
  if (prefix === thirtytwos[0]) {
    return true;
  }

  prefix = getPrefix(prefix, 24);
  if (prefix === twentyfours[0] || prefix === twentyfours[1] || prefix === twentyfours[2] || prefix === twentyfours[3] || prefix === twentyfours[4]) {
    return true;
  }

  prefix = getPrefix(prefix, 16);
  if (prefix === sixteens[0] || prefix === sixteens[1]) {
    return true;
  }

  prefix = getPrefix(prefix, 15);
  if (prefix === fifteens[0]) {
    return true;
  }

  prefix = getPrefix(prefix, 12);
  if (prefix === twelves[0]) {
    return true;
  }

  prefix = getPrefix(prefix, 10);
  if (prefix === tens[0]) {
    return true;
  }

  prefix = getPrefix(prefix, 8);
  if (prefix === eights[0] || prefix === eights[1]  || prefix === eights[2]) {
    return true;
  }

  prefix = getPrefix(prefix, 4);
  if (prefix === fours[0] || prefix === fours[1]) {
    return true;
  }

  return false;
};

exports.format = function (numstr) {
  var num = Number(numstr),
    buf = new Buffer(4);
  buf.writeUInt32BE(num, 0);
  return buf[0] + '.' + buf[1] + '.' + buf[2] + '.' + buf[3];
};
