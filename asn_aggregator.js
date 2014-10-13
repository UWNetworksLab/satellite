/*
 * Aggregate a study by ASN#
 * Given an uncompressed study directory, the data is compressed to a denser mapping of
 * domain -> {asn -> {ip -> %}}
 */

var Q = require('q');
var fs = require('fs');
var es = require('event-stream')
var chalk = require('chalk')
var dns = require('native-dns-packet');
var sys = require('sys');
var exec = require('child_process').exec;
function puts(error, stdout, stderr) { sys.puts(stdout) }

// actually: http://archive.routeviews.org/dnszones/originas.bz2
// but domain defaults to broken ipv6 resolution.
var as_file = "http://128.223.51.20/dnszones/originas.bz2";
var rundir = process.argv[2];
if (!rundir) {
  console.error(chalk.red("Run to aggregate must be specified."));
  process.exit(1);
}
if (!process.argv[3]) {
  console.error(chalk.red("Output file must be specified."));
  process.exit(1);
}

if (!fs.existsSync('originas.bz2') ||
    new Date() - fs.statSync('originas.bz2').mtime > (1000 * 60 * 60 * 24 * 30)) {
  console.log(chalk.blue("Refreshing OriginAS List"));
  exec("curl -O " + as_file, puts);
  exec("bunzip2 originas.bz2", puts);
}

// Take a line of the origin AS file and load it into a hash map.
// Map format is {start -> {cidr -> asn}}
var parseASLineRegex = /IN TXT\s+"(\d+)" "(\d+\.\d+\.\d+\.\d+)" "(\d+)"/;
function parseASLine(map, line) {
  var result = parseASLineRegex.exec(line),
      start;
  if (result) {
    start = new Buffer(result[2].split('.')).readInt32BE(0);
    start -= start % 256  // make sure it's class C.
    if (!map[start]) {
      map[start] = {};
    }
    map[start][parseInt(result[3])] = parseInt(result[1]);
  }
};

function doASLookup(ip, off) {
  if (!ip) {
    return 'unknown';
  }
  if (!off) {
    off = 0;
  }
  var classC;
  if (typeof ip === 'string') {
    var bytes = ip.split('.');
    if (bytes.length < 4) {
      return 'unknown';
    }
    classC = new Buffer(bytes).readInt32BE(0);
    classC -= classC % 256;
  } else {
    classC = ip;
  }
  while (off < 16) {
    if (this[classC]) {
      var keys = Object.keys(this[classC]);
      for (var i = 24 - off; i > 8; i--) {
        if (keys.indexOf('' + i) >= 0) {
          return this[classC]['' + i];
        }
      }
    }
    off += 1;
    classC -= classC % (256 << (off)); 
  }
  return 'unknown';
};

// Build the in memory representation of the origin ip->asn mapping.
// Returns promise with that map.
function makeASMap() {
  console.log(chalk.blue("Building ASN Mapping"));
  var map = {};
  map.lookup = doASLookup;
  return Q.Promise(function(resolve, reject) {
    fs.createReadStream("originas", {flags: 'r'})
      .pipe(es.split())  //split on new lines
      .pipe(es.mapSync(parseASLine.bind({}, map)))
      .on('end', function() {resolve(map);})
      .on('error', function(err) { reject('Error Building ASN Mapping' + err); });
  });
}

function loadASMap() {
  var prom = Q(0);
  if (!fs.existsSync('asmap.json') ||
      new Date() - fs.statSync('asmap.json').mtime > (1000 * 60 * 60 * 24 * 30)) {
        prom = prom.then(makeASMap).then(function(map) {
          var lu = map.lookup;
          delete map.lookup;
          fs.writeFileSync("asmap.json", JSON.stringify(map));
          map.lookup = lu;
          return map;
        });
  } else {
    prom = prom.then(function() {
      var map = JSON.parse(fs.readFileSync("asmap.json"));
      map.lookup = doASLookup;
      return map;
    });
  }
  return prom;
}

function parseDomainLine(map, into, domain, line) {
  var parts = line.toString('ascii').split(',');
  if (parts.length !== 3) {
    return;
  }
  var asn = map.lookup(parts[0]);
  var record;
  try {
    record = dns.parse(new Buffer(parts[2], 'hex'));
    if (!into[asn]) {
      into[asn] = {};
    }
    if (record.answer.length > 0) {
      record.answer.forEach(function(answer) {
        var ip = answer.address;
        if (!into[asn][ip]) {
          into[asn][ip] = 1;
        } else {
          into[asn][ip] += 1;
        }
      });
    } else {
      if (!into[asn].empty) {
        into[asn].empty = 0;
      }
      into[asn].empty += 1;
    }
  } catch(e) {
    into.failed += 1;
    return;
  }
}

// Read one csv file line by line.
function collapseSingle(map, domain, file) {
  var into = {
    failed: 0
  };
  if (fs.existsSync(rundir + '/' + file + '.asn.json')) {
    return Q(0);
  }

  return Q.Promise(function(resolve, reject) {
    fs.createReadStream(rundir + '/' + file)
      .pipe(es.split())
      .pipe(es.mapSync(parseDomainLine.bind({}, map, into, domain)))
      .on('end', resolve)
      .on('error', reject);
  }).then(function(m) {
    fs.writeFileSync(rundir + '/' + file + '.asn.json', JSON.stringify(into));
    delete into;
    return true;
  });
}

function collapseAll(asm) {
  var files = fs.readdirSync(rundir);
  console.log(chalk.blue("Starting Aggregation of %d domains"), files.length);
  return Q.Promise(function(resolve, reject) {
    var base = Q(0);
    var n = 0;
    var allFiles = [];
    files.forEach(function(domain) {
      if (domain.indexOf('.csv') < 0 || domain.indexOf('asn.json') > 0) {
        return;
      }
      allFiles.push(domain);
      var dn = domain.split('.csv')[0];
      n += 1;
      if (n%100 === 0) {
        base.then(function() {
          console.log(chalk.blue("."));
        })
      }
      if (n%1000 === 0) {
        base.then(function(x) {
          console.log(chalk.green(x));
        }.bind({},n))
      }
      base = base.then(collapseSingle.bind({}, asm, dn, domain));
    });
    return base.then(function() {
      console.log(chalk.green('Done.'));
      return allFiles;
    }).then(resolve, reject);
  });
}

var queue;
function writeMap(files) {
  console.log(chalk.blue('Writing Compiled Map.'));
  var stream = fs.createWriteStream(process.argv[3]);
  return Q.Promise(function(resolve, reject) {
    stream.on('finish', resolve);
    stream.on('error', reject);

    stream.write("{'length':" + files.length);

    queue = files;
    aggregateMap(stream);
  }).then(function() {
    console.log(chalk.green('Done.'));
    console.log(chalk.blue('Cleaning Up.'));
    var all = fs.readdirSync(rundir);
    all.forEach(function(file) {
      if (file.indexOf('.asn.json') > 0) {
        fs.unlinkSync(rundir + '/' + file);
      }
    });
  });
}

function aggregateMap(stream) {
  if (queue.length) {
    var next = queue.pop();
    var domain = next.split('.csv')[0];
    stream.write(",'" + domain + "':");
    if(stream.write(fs.readFileSync(rundir + '/' + next + '.asn.json'))) {
      process.nextTick(aggregateMap.bind({}, stream));
    } else {
      stream.once('drain', aggregateMap.bind({}, stream));
    }
  } else {
    stream.write("}");
    stream.end();
  }
}

loadASMap()
.then(collapseAll)
.then(writeMap)
.then(function() {
  console.log(chalk.green('Done'));
  process.exit(0);
},function(err) {
  console.error(chalk.red(err));
});
