var Q = require('q');
var fs = require('fs');
var http = require('http');
var chalk = require('chalk');
var dns = require('dns');
var getClassC = require('../util/ip_utils.js').getClassC;

if (!process.argv[2]) {
  console.error(chalk.red("Usage: find-redirects.js <rundir> <domains> <outputPrefix>"));
  process.exit(1);
}
var inFile = process.argv[2];
var outPrefix = process.argv[3];

var CONCURRENT_HTTP_REQUESTS = 10;
var CONCURRENT_DNS_REQUESTS = 10;
var RETRIES = 3;

function doHTTP(domain) {
  return Q.Promise(function (resolve, reject) {
    var req = http.request({
      host: domain,
      method: 'HEAD',
      agent: false,
      headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'}
    });

    req.on('response', function (res) {
      resolve({
        code: res.statusCode,
        location: res.headers.location
      });
    });

    req.on('error', function (err) {
      req.abort();
      reject(err);
    });

    req.on('socket', function (socket) {
      socket.setTimeout(20000);
      socket.on('timeout', function () {
        req.abort();
        reject('timeout');
      });
    });

    req.end();
  });
}

function httpWorker(domains, data) {
  return Q.Promise(function (resolve, reject) {
    var doQuery = function () {
      var domain;

      if (domains.length > 0) {
        domain = domains.pop();
        return doHTTP(domain).then(function (result) {
          data[domain].code = result.code;
          data[domain].location = result.location;
          return doQuery();
        }, function (err) {
          data[domain].code = -1;
          if (err === 'timeout') {
            data[domain].httpTimeouts = data[domain].httpTimeouts || 0;
            data[domain].httpTimeouts += 1;
          } else {
            data[domain].httpErr = err;
          }
          return doQuery();
        })
      } else {
        resolve();
      }
    };
    doQuery();
  });
}

function doAllHTTP(domains) {
  var base = Q(),
    data = {},
    todo, i;

  domains.forEach(function (domain) {
    data[domain] = {};
  });
  todo = domains;

  for (i = 0; i < RETRIES && todo.length > 0; i++) {
    base = base.then(function () {
      return Q.all(new Array(CONCURRENT_HTTP_REQUESTS).join().split(',').map(function () {
        return httpWorker(todo, data);
      }))
    }, console.error).then(function () {
      return Q.Promise(function (resolve, reject) {
        todo = Object.keys(data).filter(function (domain) {
          return data[domain].code < 0;
        });
        resolve();
      });
    }, console.error).delay(60 * 1000); // cool down a bit between retries
  }

  return base.then(function () {
    fs.writeFileSync(outPrefix + '-http.json', JSON.stringify(data));
    return data;
  }, console.error);
}

function dnsWorker(domains, data) {
  return Q.Promise(function (resolve, reject) {
    var doQuery = function () {
      var domain;

      if (domains.length > 0) {
        domain = domains.pop();
        return Q.nfcall(dns.resolve4, domain).then(function (answers) {
          data[domain].ips = answers;
          return doQuery();
        }, function (err) {
          data[domain].ipsErrors = data[domain].ipsErrors || 0;
          data[domain].ipsErrors += 1;
          data[domain].ipsLastErr = err;
          return doQuery();
        })
      } else {
        resolve();
      }
    };
    doQuery();
  });
}

function doAllDNS(data) {
  var base = Q(),
    todo, i;

  todo = Object.keys(data).filter(function (domain) {
    var redirect;
    if (Math.floor(data[domain].code / 100) == 3 && data[domain].location) {
      redirect = data[domain].location.match(/https?:\/\/([a-zA-Z0-9.-]*)/);
      if (redirect && redirect[1]) {
        data[domain].redirect = redirect[1];
        data[redirect[1]] = data[redirect[1]] || {};
        return true;
      }
    }
    return false;
  });

  todo = todo.concat(todo.map(function (domain) {
    return data[domain].redirect;
  }));

  for (i = 0; i < RETRIES && todo.length > 0; i++) {
    base = base.then(function () {
      return Q.all(new Array(CONCURRENT_DNS_REQUESTS).join().split(',').map(function () {
        return dnsWorker(todo, data);
      }))
    }).then(function () {
      return Q.Promise(function (resolve, reject) {
        todo = [];

        Object.keys(data).forEach(function (domain) {
          if (data[domain].redirect) {
            if (!data[domain].ips) {
              todo.push(domain);
            }
            if (!data[data[domain].redirect].ips) {
              todo.push(data[domain].redirect);
            }
          }
        });
        resolve();
      });
    });
  }

  return base.then(function () {
    fs.writeFileSync(outPrefix + '-dns.json', JSON.stringify(data));
    return data;
  }, console.error);
}

function findUniqRedirect(data) {
  var results = [];

  Object.keys(data).filter(function (domain) {
    return data[domain].ips && data[domain].redirect && data[data[domain].redirect].ips;
  }).forEach(function (domain) {
    var originalClassC = {},
      newClassC;

    data[domain].ips.forEach(function (ip) {
      originalClassC[getClassC(ip)] = true;
    });

    newClassC = data[data[domain].redirect].ips.filter(function (ip) {
      return !originalClassC[getClassC(ip)];
    });

    if (newClassC.length > 0) {
      results.push([domain, data[domain].redirect]);
    }
  });

  fs.writeFileSync(outPrefix + '-uniqRedirects.csv', results.map(function (record) {
    return record.join(',');
  }).join('\n'));

  fs.writeFileSync(outPrefix + '-uniqRedirects.txt', results.map(function (record) {
    return record[1];
  }).join('\n'));
}

doAllHTTP(fs.readFileSync(inFile).toString()
  .split('\n')
  .filter(function (domain) {
    return domain != '';
  }))
  .then(doAllDNS)
  .then(findUniqRedirect, console.error);
