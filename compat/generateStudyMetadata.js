/*jslint node:true */
'use strict';

var fs = require('fs');
var spawn = require('child_process').spawn;
var glob = require('glob');
var filesize = require('filesize');

var template = {
    "uniqid": "washington-dns",
    "name": "Longterm DNS Survey",
    "status": "alpha",
    "short_desc": "Tracking of the resolution of the alexa top-10000 domains resolved against active DNS resolvers.",
    "long_desc": "Periodically a full zmap scan is made to find working DNS resolvers in the ipv4 space. Regular measurements of the top 10000 domains are then performed across the roughly 2million subnets with active resolvers.",
    "organization": {
      "name": "University of Washington",
      "website": "https://www.cs.washington.edu"
    },
    "contact": {
      "name": "Research Team",
      "email": "satellite-abuse@cs.washington.edu"
    },
    "authors": ["Will Scott", "Adam Lerner", "Tadayoshi Kohno", "Arvind Krishnamurthy"],
    "tags": ["UDP/53", "DNS"],
    "files": [],
    "created_at": "",
    "updated_at": ""
  };

var conn, buffer, cb;
var sftp = function (cmd, cb) {
  var creds = require('./util/config').getKey('archive_args');
  if (!creds) {
    console.error("Unset archive options. Aborting");
    exit(0);
  }
  conn = spawn('sftp', creds);
  buffer = "";
  conn.stdout.setEncoding('utf8');
  conn.stdin.setEncoding('utf8');
  conn.stderr.setEncoding('utf8');
  conn.stdout.on('data', function (data) {
    buffer += data;
  });
  conn.stderr.on('data', function (data) {
    console.log('SFTP STDERR:', data);
  });
  conn.stdin.on('STFP ERROR:', console.log.bind(console, 'stdin'));
  conn.on('exit', function () {
    conn = undefined;
    cb(buffer);
  });
  conn.stdin.end(cmd);
};

// See if there's a local .tgz for a given date
var getPathForDate = function (date) {
  if (fs.existsSync("runs/" + date + "/zmap.tgz")) {
    return "runs/" + date + "/zmap.tgz";
  } else if (fs.existsSync("runs/" + date + ".tgz")) {
    return "runs/" + date + ".tgz";
  }
};

var finishMetaData = function (files) {
  var existing = {},
    templateString;
  if (fs.existsSync('dns.study')) {
    JSON.parse(fs.readFileSync('dns.study')).files.forEach(function (file) {
      existing[file.name] = file;
    });
  }
  files.forEach(function (file) {
    if (!file.length) {
      return;
    }
    var data = {
      "name": "runs/" + file + '.tgz',
      "description": "scan data from " + file,
      "updated-at": file
    };
    if (existing[data.name] && existing[data.name].size) {
      data.size = existing[data.name].size;
    } else {
      var path = getPathForDate(file);
      if (path) {
        data.size = filesize(fs.statSync(path).size, {unix: true});
      }
      if (fs.existsSync(path + '.sig')) {
        data.fingerprint = fs.readFileSync(path + '.sig', "utf-8").toString().trim();
      }
    }
    if (existing[data.name] && existing[data.name].fingerprint) {
      data.fingerprint = existing[data.name].fingerprint;
    }
    template.files.push(data);
  });
  templateString = JSON.stringify(template, null, 4);
  fs.writeFileSync('dns.study', templateString);
  console.log('Uploading Metadata...');
  sftp('cd data/dns\nput dns.study', function () {
    console.log('Done.');
    process.exit(0);
  });
  //queueCmd('put dns.study', function() {
  console.log('Done.');
  //  process.exit(0);
  //});
};


// Get local list.
var localArchives = glob.sync('runs/{*.tgz,*/*.tgz}');
var localDates = localArchives.map(function (file) {
  if (file.indexOf("zmap.tgz") > -1) {
    return file.split("/zmap.tgz")[0].split("/").pop();
  } else {
    return file.split(".tgz")[0].split("/").pop();
  }
});

// Wait for remote list
var remoteArchives = [];
var finalArchives = [];
sftp('cd data/dns/runs\nls', function (remote) {
  remoteArchives = remote.split(/\s+/);
  remoteArchives.forEach(function (file) {
    if (file.indexOf('.tgz') < 0 || file.length === 0) {
      return;
    }
    file = file.split('.tgz')[0].trim();
    finalArchives.push(file);
    if (localDates.indexOf(file) > -1) {
      localDates.splice(localDates.indexOf(file), 1);
    }
  });
  // Local Dates is now things to upload.
  var cmd = 'cd data/dns/runs\n',
    todo = 0;
  localDates.forEach(function (file) {
    console.log('new: ' + file);
    var path;
    for (var i = 0; i < localArchives.length; i += 1) {
      if (localArchives[i].indexOf(file) > -1) {
        path = localArchives[i];
        break;
      }
    }
    todo += 1;
    cmd += 'put ' + path + ' ' + file + '.tgz\n';
    finalArchives.push(file);
  });
  console.log('Uploading Data [' + todo + ' files]...');
  sftp(cmd, finishMetaData.bind({}, finalArchives));
});
