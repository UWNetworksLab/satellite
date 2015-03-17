/*jslint node:true */
'use strict';

exports.getClassC = function (ip) {
  var classC, bytes;
  if (typeof ip === 'string') {
    bytes = ip.split('.');
    if (bytes.length < 4) {
      return 'unknown';
    }
    classC = new Buffer(bytes).readUInt32BE(0);
    classC -= classC % 256;
  } else {
    classC = ip;
  }
  return classC;
};

