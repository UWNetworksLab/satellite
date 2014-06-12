var dns = require('native-dns-packet');
var fs = require('fs');

var type = 1;

var packet = new dns();
packet.header.id = Math.round(Math.random() * 0xffff);
packet.question.push({
  name: process.argv[2],
  type: type,
  class: 1
});
var buffer = new Buffer(200);
var len = dns.write(buffer, packet);
var prefix = buffer.slice(0, len);
fs.writeFile('query.pkt', prefix);
