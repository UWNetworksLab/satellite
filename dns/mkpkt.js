/*jslint node:true*/
'use strict';

// Input: An output filename and a domain name
// Output: Writes a DNS request packet for the domain name into the output filename.
var Dns = require('native-dns-packet');
var fs = require('fs');

var mkPkt = function (domain, file) {
  var type = 1,
    packet = new Dns(),
    buffer,
    len,
    prefix;

  packet.header.id = Math.round(Math.random() * 0xffff);
  packet.question.push({
    name: domain,
    type: type,
    "class": 1
  });
  buffer = new Buffer(200);
  len = Dns.write(buffer, packet);
  prefix = buffer.slice(0, len);
  fs.writeFile(file, prefix);
};

if (!module.parent) {
  mkPkt(process.argv[3], process.argv[2]);
} else {
  exports.make = mkPkt;
}
