// Input: toBigQuery.js <tablename> <data> 
// Output - logging messages indicating success or failure.
// If the table named doesn't exist it is created with the schema of the first
// row of the data. Otherwise the data is inserted into the existing table of
// that name.

// Dependencies
var googleapis = require('googleapis');
var bigquery = googleapis.bigquery('v2');
var authData = require('./authData');
var util = require('util');

var fs = require('fs'),
    readline = require('readline'),
    stream = require('stream');

var PROJECT_ID = 'censor-watch';
var DATASET_ID = 'dns';
var tableId = process.argv[2];
var dataFilename = process.argv[3];
var DUPE_TABLE_CODE = 409;

// Create JWT auth object
var authClient = new googleapis.auth.JWT(
  authData.email,
  authData.keyFile,
  authData.key,
  authData.scopes,
  authData.subject
);

var input = fs.createReadStream(dataFilename);
var rows = [];

/** Line chunker from http://strongloop.com/strongblog/practical-examples-of-the-new-node-js-streams-api/ */
var liner = require('./liner').liner;

var toJson = new stream.Transform( { objectMode: true } );
toJson._transform = function (line, encoding, done) {
  rows.push({json: JSON.parse(line)}); 
  done();
}
input.pipe(liner).pipe(toJson);

toJson.on('finish', function() {
  // Authorize
  authClient.authorize(function (err, data) {
    if (err) { 
      console.log('There was an error authorizing.');
      throw err;
    }
    console.log('You have been successfully authenticated: ', data);

    bigquery.datasets.list({auth: authClient, projectId: PROJECT_ID},
      function(err, results) {
        if (err) { 
          console.log('Error listing');
          throw err;
        } 
        var datasetsIDs = results.datasets.map(function(dataset) {
          return dataset.datasetReference.datasetId;
        });
        if (datasetsIDs.indexOf(DATASET_ID) === -1) {
          console.log(util.format('Dataset %s does not exist, aborting.', DATASET_ID));
          return;
        }

        // Insert the requested table, ignoring duplicate table errors.
        // (In other words, add the table if it doesn't already exist).
        var tableResource = { 
          tableReference: {
            datasetId: DATASET_ID,
            projectId: PROJECT_ID,
            tableId: tableId
          },
          schema: {
            fields: [
              {name: 'server_ip', type: 'STRING', description: 'IP of the DNS server queried' },
              {name: 'timestamp', type: 'STRING', description: 'Datetime of resolution.'},
              {name: 'answer', type: 'STRING',  description: 'IP returned by the server.'},
              {name: 'domain', type: 'STRING',  description: 'Domain asked about.'},
              {name: 'ttl', type: 'INTEGER',  description: 'TTL of answer.'},
              {name: 'type', type: 'INTEGER',  description: 'Type of answer.'},
              {name: 'class', type: 'INTEGER',  description: 'Class of answer.'},
            ]
          }
        }
        bigquery.tables.insert({auth: authClient, projectId: PROJECT_ID, 
            datasetId: DATASET_ID, resource: tableResource},
          function(err, results) {
            if (err && err.code !== DUPE_TABLE_CODE) {
              console.log(util.format('Error inserting new table: %j', err));
              console.log(err.code);
              throw err;
            }
            var insertAllRequestBody = {
              kind: 'bigquery#tableDataInsertAllRequest',
              rows: rows
            };
            bigquery.tabledata.insertAll({auth: authClient, projectId: PROJECT_ID,
                                          datasetId: DATASET_ID, tableId: tableId,
                                          resource: insertAllRequestBody},
              function(err, results) {
                if (err) {
                  console.log('error while inserting data');
                  throw err;
                }
                console.log('results of insertAll: ' + JSON.stringify(results));
              }
            );
          }
        );
      }
    );
  });
});
