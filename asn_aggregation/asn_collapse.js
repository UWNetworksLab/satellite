/*
 * Collapse. From:
 * domain -> {asn -> {ip -> %}}
 * to:
 * domain -> {asn -> % chance bad}
 */

exports.collapseDomain = function(asnmap) {
  var iptotals = {};

  Object.keys(asnmap).forEach(function(asn) {
    Object.keys(asnmap[asn]).forEach(function(ip) {
      if (!iptotals[ip]) {
        iptotals[ip] = 0;
      }
      iptotals[ip] += asnmap[asn][ip];
    });
  });

  // IP Density.
  var totalIps = Object.keys(iptotals).reduce(function(a, b) {return a + iptotals[b]}, 0);
  var sortedIPs = Object.keys(iptotals).sort(function(a, b) {return iptotals[a] - iptotals[b];});

  var ips = sortedIPs.length; majority = 0, threshold = totalIps * 0.67;
  for (var i = 0; i < ips; i++) {
    majority += iptotals[sortedIPs[i]];
    if (majority > threshold) {
      majority = i;
      break;
    }
  }

  console.log('majority held by ' + majority + ' IPs.');
  if (majority === 1) {
    // Single Homed. Common Case.
    console.log('e.g. Single Homed.');
  }

  //Each ASN gets graded by how much of it is in the majority.
  var out = {};
  Object.keys(asnmap).forEach(function(asn) {
    var good = 0, bad = 0;
    Object.keys(asnmap[asn]).forEach(function(ip) {
      if (sortedIps.indexOf(ip) < majority) {
        good += asnmap[asn][ip];
      } else {
        bad += asnmap[asn][ip]
      }
    });
    if (good + bad > 0) {
      out[asn] = good / (good + bad);
    }
  });

  return out;
}

exports.collapseasnjson = function(map) {
  var out = {};
  Object.keys(map).forEach(function(domain) {
    out[domain] = exports.collapseDomain(map[domain]);
  });
  return out;
};
