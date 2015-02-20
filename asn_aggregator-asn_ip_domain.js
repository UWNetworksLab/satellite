/*
 * Aggregate a study by ASN#
 * Given an uncompressed study directory, the data is compressed to a denser mapping of
 * asn -> {ip -> {domain -> count}}
 */

var Q = require('q');
var fs = require('fs');
var es = require('event-stream')
var chalk = require('chalk')
var asn = require('./asn_aggregation/asn_lookup')
var dns = require('native-dns-packet');

var rundir = process.argv[2];
if (!rundir) {
  console.error(chalk.red("Run to aggregate must be specified."));
  process.exit(1);
}
if (!process.argv[3]) {
  console.error(chalk.red("Output file must be specified."));
  process.exit(1);
}

function parseDomain(file, ip_asn, asn_ip_domains, domain_id) {
  return Q.Promise(function(resolve, reject) {
    fs.createReadStream(rundir + '/' + file)
      .pipe(es.split())
      .pipe(es.mapSync(parseDomainLine.bind({}, ip_asn, asn_ip_domains, domain_id)))
      .on('end', resolve)
      .on('error', reject);
  });
}

function parseAll(ip_asn) {
  var files = fs.readdirSync(rundir),
    asn_ip_domains = {},
    domain_id = 0,
    base = Q(0);

  asn_ip_domains.domain_id = {};
  console.log(chalk.blue('Starting Aggregation of %d domains'), files.length);

  return Q.Promise(function(resolve, reject) {
    var n = 0;

    files.filter(function(file) {
      return file.match(/\.csv$/);
    }).forEach(function(file) {
      asn_ip_domains.domain_id[domain_id] = file.replace(/\.csv$/, '');

      n += 1;
      if (n % 100 == 0) {
        base = base.then(function() {
          console.log(chalk.blue("."));
        })
      }
      if (n % 1000 == 0) {
        base = base.then(function(x) {
          console.log(chalk.green(x));
        }.bind({}, n))
      }

      base = base.then(parseDomain.bind({}, file, ip_asn, asn_ip_domains, domain_id));
      domain_id++;
    });

    return base.then(function() {
      console.log(chalk.green('Done.'));
      return asn_ip_domains;
    }).then(resolve, reject);
  });
}

function parseDomainLine(ip_asn, asn_ip_domains, domain_id, line) {
  var parts = line.toString('ascii').split(',');

  if (parts.length == 3) {
    var asn = ip_asn.lookup(parts[0]);

    if (asn !== 'unknown') {
      asn_ip_domains[asn] = asn_ip_domains[asn] || {};

      try {
        var record = dns.parse(new Buffer(parts[2], 'hex'));
        if (record.answer.length > 0) {
          record.answer.forEach(function(answer) {
            var ip = answer.address;
            if (ip === undefined) {
              asn_ip_domains[asn].failed = asn_ip_domains[asn].failed || 0;
              asn_ip_domains[asn].failed++;
            } else {
              asn_ip_domains[asn][ip] = asn_ip_domains[asn][ip] || {};
              asn_ip_domains[asn][ip][domain_id] = asn_ip_domains[asn][ip][domain_id] || 0;
              asn_ip_domains[asn][ip][domain_id] += 1;
            }
          });
        }
      } catch (e) {
        asn_ip_domains[asn].failed = asn_ip_domains[asn].failed || 0;
        asn_ip_domains[asn].failed++;
        return;
      }
    }
  }
}

function writeMap(asn_ip_domains) {
  console.log(chalk.blue('Writing Compiled Map.'));
  var stream = fs.createWriteStream(process.argv[3]);
  return Q.Promise(function(resolve, reject) {
    stream.on('finish', resolve);
    stream.on('error', reject);

    stream.write(JSON.stringify(asn_ip_domains));
    console.log(chalk.green('Done.'));
  });
}

asn.getMap()
  .then(parseAll)
  .then(writeMap)
  .then(function() {
    console.log(chalk.green('Done'));
    process.exit(0);
  }, function(err) {
    console.error(chalk.red(err));
  });