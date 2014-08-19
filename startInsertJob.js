// Starts a bigquery job to insert the data in the given file, stored in Google
// Cloud Storage, into the table given.
//
// Input: toBigQuery.js <tablename> <GoogleCloudStorageURI> 
// Output - logging messages indicating success or failure. 
//
// <GoogleCloudStorageURI> should be a fully qualified URI, for example:
// gs://censor-watch/foo.jsonList.gz
//
// If the table named doesn't exist it is created. Otherwise the data is
// inserted into the existing table of that name.
//
// This script returns once the insert job is started, but the job may not complete
// for some time.

// Dependencies
var googleapis = require('googleapis');
var bigquery = googleapis.bigquery('v2');
var authData = require('./authData');
var util = require('util');
var sleep = require('sleep');

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

var rows = [];

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
        // Ignore duplicate table errors, fail on any other error.
        function(err, results) {
          if (err && err.code !== DUPE_TABLE_CODE) {
            console.log(util.format('Error inserting new table: %j', err));
            console.log(err.code);
            throw err;
          } else if (err && err.code == DUPE_TABLE_CODE) {
            console.log('Table ' + tableId + ' already exists, inserting data into existing table.');
          }
          var insertJobRequestBody = {
            "kind": "bigquery#job",
            "configuration": {
              "load": {
                "sourceUris": [dataFilename],
                "sourceFormat": "NEWLINE_DELIMITED_JSON",
                "destinationTable": {
                  "projectId": PROJECT_ID,
                  "datasetId": DATASET_ID,
                  "tableId": tableId
                }
              }
            }
          };
          bigquery.jobs.insert({auth: authClient, projectId: PROJECT_ID,
              resource: insertJobRequestBody},
            function(err, results) {
              if (err) {
                console.log('Error starting job to insert data ' + dataFilename);
                throw err;
              }
              console.log(util.format('Started insert job of file "%s" with jobId "%s"', 
                                      dataFilename, results.jobReference.jobId));
            }
          );
        }
      );
    }
  );
});
