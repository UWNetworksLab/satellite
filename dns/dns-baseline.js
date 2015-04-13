var fs = require('fs');
var dns = require('native-dns');
var chalk = require('chalk');
var Q = require('q');

if (!process.argv[4]) {
  console.error(chalk.red('Usage: dns-baseline.js <domain file> <edns_clients file> <output file>'));
  process.exit(1);
}

var DELAY = 10 * 1000;

var inFile = process.argv[2];
var clientFile = process.argv[3];
var outFile = process.argv[4];

var results = {};
var domainsList = fs.readFileSync(inFile).toString().split('\n').filter(function (name) {
  return name !== '';
});

var ednsClients = fs.readFileSync(clientFile).toString().split('\n').filter(function (name) {
  return name !== '';
});

function doQuery(cb, question, nameserver, retries, edns_client) {
  var req = dns.Request({
    question: dns.Question(question),
    server: {
      address: nameserver,
      port: 53,
      type: 'udp'
    }
  });

  if (edns_client) {
    req.edns_client = edns_client;
  }

  req.on('message', function (err, response) {
    if (err) {
      console.log(err);
    }
    cb(response);
  });

  req.on('timeout', function () {
    if (retries > 0) {
      req.cancel();
      doQuery(cb, question, nameserver, retries - 1, edns_client);
    } else {
      req.cancel();
      cb();
    }
  });

  req.send();
}

function getNS(domain) {
  results[domain] = {};

  return Q.Promise(function (resolve, reject) {
    doQuery(function (response) {
      if (response) {
        response.answer.concat(response.authority).filter(function (answer) {
          return answer.type = dns.consts.NAME_TO_QTYPE.NS;
        }).forEach(function (answer) {
          results[domain].ns = answer.data;
        });
      }
      resolve();
    }, {name: domain, type: 'NS'}, '8.8.8.8', 3)
  });
}

function getNS_A(domain) {
  return Q.Promise(function (resolve, reject) {
    doQuery(function (response) {
      if (response && response.answer) {
        var ips = response.answer.filter(function (a) {
          return a.type == dns.consts.NAME_TO_QTYPE.A;
        }).map(function (a) {
          return a.address;
        });

        if (ips.length > 0) {
          results[domain].ns_ip = ips[0];
        }
      }
      resolve();
    }, {name: results[domain].ns, type: 'A'}, '8.8.8.8', 3)
  });
}

function getChaos(server, domains, query) {
  return Q.Promise(function (resolve, reject) {
    doQuery(function (response) {
      if (response) {
        response.answer.forEach(function (answer) {
          if (answer.name === query && answer.type === dns.consts.NAME_TO_QTYPE.TXT) {
            domains.forEach(function (domain) {
              results[domain][query] = results[domain][query] || [];
              results[domain][query].push(answer.data[0]);
            });
          }
        });
      }
      resolve();
    }, {name: query, type: 'TXT', class: 3}, server, 1);
  });
}

function getA(domain) {
  return Q.Promise(function (resolve, reject) {
    doQuery(function (response) {
      if (response) {
        results[domain].ips = response.answer.filter(function (a) {
          return a.type == dns.consts.NAME_TO_QTYPE.A;
        }).map(function (a) {
          return a.address;
        });
      }
      resolve();
    }, {name: domain, type: 'A'}, results[domain].ns_ip, 3);
  });
}

function getEDNS(domain) {
  var handler = function (resolve, client, response) {
    if (response) {
      response.additional.filter(function (a) {
        return a.options;
      }).forEach(function (a) {
        a.options.forEach(function (opt) {
          if (opt.code == 8 && opt.data[3] > 0) {
            results[domain].edns = results[domain].edns || {};
            results[domain].edns[client] = response.answer.filter(function (a) {
              return a.type == dns.consts.NAME_TO_QTYPE.A;
            }).map(function (a) {
              return a.address;
            });
          }
        });
      });
    }
    resolve();
  };

  return Q.Promise(function (resolve, reject) {
    doQuery(handler.bind({}, resolve, ednsClients[0]),
      {name: domain, type: 'A'},
      results[domain].ns_ip,
      3,
      {ip: ednsClients[0], mask: 24});
  }).then(function () {
    var base = Q().delay(DELAY);

    if (results[domain].edns) {
      for (var i = 1; i < ednsClients.length; i++) {
        base = base.then(function (client) {
          return Q.Promise(function (resolve, reject) {
            doQuery(handler.bind({}, resolve, ednsClients[client] + '/24'),
              {name: domain, type: 'A'},
              results[domain].ns_ip,
              3,
              {ip: ednsClients[client], mask: 24});
          }).delay(DELAY);
        }.bind({}, i));
      }
    }
    return base;
  });
}

function doAll(f, els) {
  var base = Q();
  els.forEach(function (el) {
    base = base.then(function () {
      return f(el)
    });
  });
  return base;
}

doAll(getNS, domainsList)
  .then(function () {
    var domains = Object.keys(results).filter(function (domain) {
      return results[domain].ns;
    });
    return doAll(getNS_A, domains);
  })
  .then(function () {
    var nsToDomain = {};

    Object.keys(results).filter(function (domain) {
      return results[domain].ns_ip;
    }).forEach(function (domain) {
      nsToDomain[results[domain].ns_ip] = nsToDomain[results[domain].ns_ip] || [];
      nsToDomain[results[domain].ns_ip].push(domain);
    });

    return Q.all(
      Object.keys(nsToDomain).map(function (ns) {
        var domains = nsToDomain[ns];

        return getChaos(ns, domains, 'version.bind')
          .delay(DELAY)
          .then(getChaos.bind({}, ns, domains, 'hostname.bind'))
          .delay(DELAY)
          .then(getChaos.bind({}, ns, domains, 'authors.bind'))
          .delay(DELAY)
          .then(doAll.bind({}, getA, domains))
          .delay(DELAY)
          .then(doAll.bind({}, getEDNS, domains));
      })
    )
  })
  .then(function () {
    fs.writeFileSync(outFile, JSON.stringify(results));
  }, function (err) {
    console.error(err);
  });