/*
 * Used to parse cs.washington.edu.csv to figure out which resolvers were included within an aggregation.
 *
 * Returns the list of unique classC spaces.
 */

var Q = require('q');
var fs = require('fs');
var es = require('event-stream');
var chalk = require('chalk');
var dns = require('native-dns-packet');
var progressBarStream = require('progressbar-stream');

if (!process.argv[4]) {
  console.error(chalk.red("Usage: filter-resolvers.js <server-list.txt> <cs.washington.edu.csv> <output.txt>"));
  process.exit(1);
}

var serverList = process.argv[2];
var probeFile = process.argv[3];
var outFile = process.argv[4];


function filterServerList() {
  return Q.Promise(function (resolve, reject) {
    var total = fs.statSync(probeFile).size,
      servers = readServerList(serverList);

    console.log(chalk.blue("Generating Server List"));
    fs.createReadStream(probeFile)
      .pipe(progressBarStream({total: total}))
      .pipe(es.split())
      .pipe(es.mapSync(
        function (line) {
          var parts = line.split(','),
            record;
          if (parts.length == 3) {
            try {
              record = dns.parse(new Buffer(parts[2], 'hex'));
            } catch (e) {
              return;
            }
            if (record.answer.length > 0 && record.answer[0].address !== '128.208.3.200') {
              delete servers[parts[0] + '/32'];
            }
          }
        }
      ))
      .on('end', function () {
        fs.appendFileSync(outFile, Object.keys(servers).join('\n') + '\n');
        resolve(chalk.green('Done.'));
      })
      .on('error', reject);
  });
}

function readServerList() {
  var result = {},
    servers = fs.readFileSync(serverList).toString().split('\n');

  servers.forEach(function (server) {
    result[server] = true;
  });

  return result;
}

filterServerList().then(console.log, console.error);