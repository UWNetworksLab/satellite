/**
 * account for domains by finding the most likely way to determine correct and
 * incorrect responses for each one. The signals checked for significance in
 * order of preference are:
 * * IP - if there are <= 4 IPs accounting for 75% of all resolutions, domain
 *   is considered single homed, and those IPs are considered "correct".
 * * ASN - if there is a single ASN accounting for > 75% of all resolutions,
 *   that ASN IP space is considered "correct".
 * * PTR - if there is a 2nd level (below country code) domain found > 75% of
 *   all resolutions, then responses to IPs with that reverse PTR are "correct".
 * * Server - If there is a http server signature common between > 75% of all
 *   resolutions, then that header is considered to be "correct".
 * Other signals to do based on availablilty of data are WHOIS responses.
 */

var es = require('event-stream');
var fs = require('fs');
var ip2country = require('ip2country');
var progress = require('progressbar-stream');
var jsonlinesloader = require('../util/jsonlinesloader');

// Usage: domain_signature.js <asn.json> <lookup.json> <ptrs.json> <servers.json> <output.json>
var a_asn = process.argv[2];
var a_lookup = process.argv[3];
var a_ptrs = process.argv[4];
var a_servers = process.argv[5];
var a_output = process.argv[6];

// Load lookup tables:
var ip2asn = JSON.parse(fs.readFileSync(a_lookup));
ip2asn.lookup = ip2country.lookup.bind({}, ip2asn);
var ptrs = jsonlinesloader.load(a_ptrs);
var servers = jsonlinesloader.load(a_servers);

var getSignature = function(output, domLine) {
  if (!domLine.length) {
    return;
  }
  var dom;
  try {
    dom = JSON.parse(domLine);
  } catch (e) {
    return;
  }
  if (!dom.name) {
    return;
  }

  var totalResolutions = 0;
  var r_ips = {};
  var r_asns = {};
  var r_ptrs = {};
  var r_servers = {};

  // Calculate sums for the quantities.
  Object.keys(dom).forEach(function(asn) {
    if (!Number(asn) || typeof dom[asn] !== 'object') {
      return;
    }
    Object.keys(dom[asn]).forEach(function(ip) {
      totalResolutions += dom[asn][ip];
      if (!r_ips[ip]) {
        r_ips[ip] = 0;
      }
      r_ips[ip] += dom[asn][ip];

      var ipas = ip2asn.lookup(ip);
      if (!r_asns[ipas]) {
        r_asns[ipas] = 0;
      }
      r_asns[ipas] += dom[asn][ip];

      var ptr = ptrs[ip];
      if (ptr && ptr[1].length && ptr[1][0].indexOf(".")) {
        ptr = ptr[1][0].split(".");
        ptr = ptr[ptr.length - 2];
        if (!r_ptrs[ptr]) {
          r_ptrs[ptr] = 0;
        }
        r_ptrs[ptr] += dom[asn][ip];
      }

      var server = servers[ip];
      if (server && server[1] < 500 && server[2].length) {
        if (!r_servers[server[2]]) {
          r_servers[server[2]] = 0;
        }
        r_servers[server[2]] += dom[asn][ip];
      }
    });
  })

  totalResolutions *= 0.75;

  // 1. Check if domain is single homed.
  var ip_keys = Object.keys(r_ips).sort(function(a, b) {
    return r_ips[b] - r_ips[a];
  });
  var sum = 0;
  for (var i = 0; i < 4; i++) {
    sum += r_ips[ip_keys[i]];
    if (sum > totalResolutions) {
      // if this isn't a real 'cliff', be suspicious.
      if (ip_keys.length > i + 1 && r_ips[ip_keys[i]] < r_ips[ip_keys[i + 1]] * 1.5) {
        break;
      }
      output[dom.name] = ["IP", ip_keys.slice(0, i + 1)];
      return;
    }
  }
  ip_keys = [];

  // 2. Check if domain resolves to a single ASN.
  var as_keys = Object.keys(r_asns).sort(function(a, b) {
    return r_asns[b] - r_asns[a];
  });
  if (r_asns[as_keys[0]] > totalResolutions) {
    output[dom.name] = ["ASN", as_keys[0]];
    return;
  }
  as_keys = [];

  // 3. Check if domain is single-ptr'ed.
  var ptr_keys = Object.keys(r_ptrs).sort(function(a, b) {
    return r_ptrs[b] - r_ptrs[a];
  });
  if (r_ptrs[ptr_keys[0]] > totalResolutions) {
    output[dom.name] = ["PTR", ptr_keys[0]];
    return;
  }

  // 4. Check if domain uses a single dominant server header.
  var server_keys = Object.keys(r_servers).sort(function(a, b) {
    return r_servers[b] - r_servers[a];
  });
  if (r_servers[server_keys[0]] > totalResolutions) {
    output[dom.name] = ["SERVER", server_keys[0]];
    return;
  }

  output[dom.name] = ["UNKNOWN"];
};

var printStats = function(domains) {
  var types = {
    "IP": 0,
    "ASN": 0,
    "PTR": 0,
    "SERVER": 0,
    "UNKNOWN": 0
  };
  Object.keys(domains).forEach(function(dom) {
    types[domains[dom][0]] += 1;
  });
  Object.keys(types).forEach(function(cat) {
    console.log(cat +":\t" + types[cat]);
  });
};

// Parse each domain.
var list = {};
fs.createReadStream(a_asn)
  .pipe(progress({total: fs.statSync(a_asn).size}))
  .pipe(es.split())
  .pipe(es.mapSync(getSignature.bind({}, list)))
  .on('end', function () {
    //console.log(list);
    printStats(list);
    fs.writeFileSync(a_output, JSON.stringify(list));
    process.exit(0);
  });
