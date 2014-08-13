var fs = require('fs');
var spawn = require('child_process').spawn;

var template = {
    "uniqid": "washington-dns",
    "name": "Longterm DNS Survey",
    "status": "alpha", 
    "short_desc": "Tracking of the resolution of the alexa top-10000 domains resolved against active DNS resolvers.",
    
    "long_desc": "Periodically a full zmap scan is made to find working DNS resolvers in the ipv4 space. Regular measurements of the top 10000 domains are then performed across the roughly 2million subnets with active resolvers.",
    
    "organization": {
        "name": "University of Washington",
        "website":"https://www.cs.washington.edu"
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

var finishMetaData = function(files) {
  files.forEach(function(file) {
    template.files.push({
      "name":"runs/" + file,
      "description": "scan data from " + file.substr(file.indexOf('.')),
    });
  });
  var string = JSON.stringify(template, null, 4);
  fs.writeFileSync('dns.study', string);
  queueCmd('cd ..', function() {});
  queueCmd('lcd ..', function() {});
  //queueCmd('put dns.study', function() {
    console.log('Done.');
  //  process.exit(0);
  //});
}

var conn = spawn('sftp', ['washington@scans.io']);
var state = 0;
var cmds = [['lcd runs',function(){}], ['cd data/dns/runs',function(){}]];
var buffer = "";
var sftpcb = null;
var queueCmd = function(cmd, cb) {
  cmds.push([cmd, cb]);
  if (state == 2) {
    var cc = cmds.shift();
    conn.stdin.write(cc[0]);
    sftpcb = cc[1];
    state = 1;
  }
};

conn.stdout.setEncoding('utf8');
conn.stderr.setEncoding('utf8');
var ondata = function(data) {
  console.log('got data', data);
  if (state == 0 && data.indexOf('Connected to') > -1) {
    console.log('connected');
    state = 1; // connected.
  }
  if (data.indexOf('sftp>') > -1 && state == 1) {
    buffer += data.substr(0, data.indexOf('sftp>'));
    sftpcb(buffer);
    buffer = '';
    state = 2;
    if (cmds.length) {
      var cc = cmds.shift();
      console.log('sending: ', cc[0]);
      conn.stdin.write(cc[0]);
      sftpcb = cc[1];
      state = 1;
    }
  } else if (state > 0) {
    buffer += data;
  }
};
conn.stdout.on('data', ondata);
conn.stderr.on('data', ondata);
conn.on('exit', function() {
  process.exit();
});

// Get local list.
var localArchives = fs.readdirSync('runs').filter(function(file) {
  return file.indexOf('.tgz') > 0;
});

// Wait for remote list
var remoteArchives = [];
queueCmd('ls', function(remote) {
  remoteArchives = remote.split('\n');
  remoteArchives.forEach(function(file) {
    if (localArchives.indexOf(file) > -1) {
      localArchives.splice(localArchives.indexOf(file), 1);
    }
  });
  // Local Archives is now things to upload.
  localArchives.forEach(function(file) {
    console.log('would upload ' , file);
    //queueCmd('put ' + file, function() {})
  });
  queueCmd('ls', finishMetadata.bind({}, remoteArchives));
});

