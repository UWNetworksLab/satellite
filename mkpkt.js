// Input: An output filename and a domain name
// Output: Writes a DNS request packet for the domain name into the output filename.
var dns = require('native-dns-packet');
var fs = require('fs');

var mkPkt = function(domain, file) {
  var type = 1;

  var packet = new dns();
  packet.header.id = Math.round(Math.random() * 0xffff);
  packet.question.push({
    name: domain,
    type: type,
    class: 1
  });
  var buffer = new Buffer(200);
  var len = dns.write(buffer, packet);
  var prefix = buffer.slice(0, len);
  fs.writeFile(file, prefix);
}

if (!module.parent) {
  mkPkt(process.argv[3], process.argv[2]);
} else {
  exports.make = mkPkt;
}
