/*
 * Collapse. From:
 * domain -> {asn -> {ip -> %}}
 * to:
 * domain -> {asn -> [#good,#bad]}
 */
var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');

var inputfile = process.argv[2];
if (!inputfile) {
  console.error(chalk.red("Input file must be specified."));
  process.exit(1);
}
var outdir = process.argv[3];
if (!outdir) {
  console.error(chalk.red("Output directory must be specified."));
  process.exit(1);
}

// Read one csv file line by line.
function reduceSingle(file) {
  var into = {};

  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(outdir + '/' + file)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var parts = line.toString('ascii').split(',');
        if (parts.length !== 3) {
          return;
        }
        var ip = parts[0], domain = parts[1], count = parts[2];
        into[ip] = into[ip] || {};
        into[ip][domain] = count;
      }))
      .on('end', resolve)
      .on('error', reject);
  }).then(function () {
    fs.writeFileSync(outdir + '/' + file + '.json', JSON.stringify(into));
    return true;
  });
}

function reduceAll() {
  var files = fs.readdirSync(outdir).filter(function (file) {
    return file.match(/\.csv/);
  });

  console.log(chalk.blue("Starting Reduce of %d domains"), files.length);
  return Q.Promise(function (resolve, reject) {
    var base = Q(0);
    var allFiles = [];
    files.forEach(function (file) {
      allFiles.push(file);
      base = base.then(reduceSingle.bind({}, file));
    });
    return base.then(function () {
      console.log(chalk.green('Done.'));
      return allFiles;
    }).then(resolve, reject);
  });
}

function mapSingle(file) {
  return Q.Promise(function (resolve, reject) {
    var domain = file.replace(/\.asn\.json/, ''),
      asnmap, asn_ip_domain = {};

    asnmap = JSON.parse(fs.readFileSync(outdir + '/' + file));

    Object.keys(asnmap).forEach(function (asn) {
      if (typeof asnmap[asn] === 'object' && asn !== 'unknown') {
        var ips = Object.keys(asnmap[asn]).filter(function (ip) {
          return ip !== 'empty' && ip !== 'undefined';
        });

        if (ips.length > 0) {
          asn_ip_domain[asn] = [];
          ips.forEach(function (ip) {
            asn_ip_domain[asn].push([ip, domain, asnmap[asn][ip]]);
          });
        }
      }
    });

    console.log(file);

    Object.keys(asn_ip_domain).forEach(function (asn) {
      var records = asn_ip_domain[asn].map(function (record) {
        return record.join(',') + '\n';
      });
      fs.appendFileSync(outdir + '/' + asn + '.csv', records.join(''));
    });
    resolve();
  });
}

function mapAll() {
  var files = fs.readdirSync(outdir).filter(function (file) {
    return file.match(/\.asn\.json/);
  });
  console.log(chalk.blue("Starting Map of %d domains"), files.length);
  return Q.Promise(function (resolve, reject) {
    var base = Q(0);
    var allFiles = [];
    files.forEach(function (file) {
      allFiles.push(file);
      base = base.then(mapSingle.bind({}, file));
    });
    return base.then(function () {
      console.log(chalk.green('Done.'));
      return allFiles;
    }).then(resolve, reject);
  });
}

var splitJSON = function (file) {
  return Q.Promise(function (resolve, reject) {
    var domainRegex = /\'([^\']*)\'\:$/,
      fallbackRegex = /\"([^\"]*)\"\:$/,
      depth = 0,
      currentDomain = '',
      currentMap = '';

    var parseOutput = function () {
      //TODO: should be quotes not single quotes.
      var dr = domainRegex.exec(currentDomain);
      if (!dr[1]) {
        var cur = domainRegex;
        domainRegex = fallbackRegex;
        fallbackRegex = cur;
        dr = domainRegex.exec(currentDomain);
      }
      var domain = dr[1];
      var out = outdir + '/' + domain + '.asn.json';
      if (!fs.existsSync(out)) {
        fs.writeFileSync(out, currentMap);
      }
      currentDomain = '';
      currentMap = '';
    };

    var inputstream = fs.createReadStream(file, {encoding: 'utf8'});
    inputstream.on('readable', function () {
      var chunk;
      while (null !== (chunk = inputstream.read())) {
        for (var i = 0; i < chunk.length; i++) {
          if (chunk[i] === '{') {
            depth += 1;
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
    inputstream.on('end', function () {
      resolve();
      console.warn('Done.');
    })
  });
};

splitJSON(inputfile).then(mapAll).then(reduceAll).done();