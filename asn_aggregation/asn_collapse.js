/*
 * Collapse. From:
 * domain -> {asn -> {ip -> %}}
 * to:
 * domain -> {asn -> [#good,#bad]}
 */

var lastMap;

var collapseDomain = function(asnmap) {
  var iptotals = {};

  Object.keys(asnmap).forEach(function(asn) {
    if (typeof asnmap[asn] === 'object') {
      Object.keys(asnmap[asn]).forEach(function(ip) {
        if (!iptotals[ip]) {
          iptotals[ip] = 0;
        }
        iptotals[ip] += asnmap[asn][ip];
      });
    } else if (asn === 'failed') {
      //console.warn('domain failed for ', asnmap[asn], 'ips');
    }
  });

  // IP Density.
  var totalIps = Object.keys(iptotals).reduce(function(a, b) {return a + iptotals[b]}, 0);
  var sortedIPs = Object.keys(iptotals).sort(function(a, b) {return iptotals[b] - iptotals[a];});

  var ips = sortedIPs.length; majority = 0, threshold = totalIps * 0.67;
  for (var i = 0; i < ips; i++) {
    if (sortedIPs[i] !== 'empty') {
      majority += iptotals[sortedIPs[i]];
    }
    if (majority > threshold) {
      majority = i;
      break;
    }
  }

  //console.log('majority of ' + threshold + ' held by ' + (majority + 1) + '/' + ips + ' IPs.');
  //if (sortedIPs.indexOf('empty') < majority) {
  //  console.log('Empty IPs outweigh expected.');
  //}
  //if (majority === 0) {
  //  // Single Homed. Common Case.
  //  console.log('e.g. Single Homed.');
  //}

  //Each ASN gets graded by how much of it is in the majority.
  var out = {};
  Object.keys(asnmap).forEach(function(asn) {
    var good = 0, bad = 0;
    if (typeof asnmap[asn] === 'object') {
      Object.keys(asnmap[asn]).forEach(function(ip) {
        if (sortedIPs.indexOf(ip) <= majority) {
          good += asnmap[asn][ip];
        } else {
          bad += asnmap[asn][ip]
        }
      });
      if (good + bad > 0) {
        out[asn] = [good, bad, majority];
      }
    }
  });

  return out;
}

var streamToDC = function(file, outfile) {
  var outHandle = fs.createWriteStream(outfile);

  var countryMap = require('./asn_country');
  countryMap.onReady.then(function() {
    var collapseDomainCountry = function (domain, map) {
      // Collapse to good-bad counts per asn
      var gb = collapseDomain(map);
      // Collapse that to good-bad counts per country
      var country = countryMap.goodbad2country(gb);
      // Save the result.
      outHandle.write(JSON.stringify({domain: domain, counts: country}));
      outHandle.write('\n');
    };
    streamJSON(file, collapseDomainCountry);
  })
};

var domainRegex = /\'([^\']*)\'\:$/;
var fallbackRegex = /\"([^\"]*)\"\:$/;

var streamJSON = function(file, mapper) {
  var fs = require('fs');

  var depth = 0;
  var currentDomain = '', currentMap = '';
  
  var parseOutput = function() {
    //TODO: should be quotes not single quotes.
    var dr = domainRegex.exec(currentDomain);
    if (!dr[1]) {
      var cur = domainRegex;
      domainRegex = fallbackRegex;
      fallbackRegex = cur;
      dr = domainRegex.exec(currentDomain);
    }
    var domain = dr[1];
    lastMap = JSON.parse(currentMap);
    mapper(domain, lastMap);
    currentDomain = '';
    currentMap = '';
  };

  var inputstream = fs.createReadStream(file, {encoding:'utf8'});
  inputstream.on('readable', function() {
    var chunk;
    while(null !== (chunk = inputstream.read())) {
      for (var i = 0; i < chunk.length; i++) {
        if (chunk[i] === '{') {
          depth +=1;
          if (depth > 1) {
            currentMap += chunk[i];
          }
        } else if (chunk[i] === '}') {
          depth -= 1;
          if (depth > 0) {
            currentMap += chunk[i];
          }
          if (depth === 1) {
            parseOutput();
          }
        } else if (depth === 1) currentDomain += chunk[i];
        else if (depth > 1) currentMap += chunk[i];
      }
    }
  });
};

//streamJSON('runs/11-13-2014.asn.json')
//var ac = require('./asn_aggregation/asn_collapse')
//ac.streamToDC('runs/11-13-2014.asn.json','runs/11-13-2014.country.json')

exports.collapseDomain = collapseDomain;
exports.streamJSON = streamJSON;
exports.streamToDC = streamToDC;
