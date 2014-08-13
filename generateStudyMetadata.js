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
  console.log('Uploading Metadata...');
  sftp('cd data/dns\nput dns.study', function() {
    console.log('Done.');
    process.exit(0);
  });
  //queueCmd('put dns.study', function() {
    console.log('Done.');
  //  process.exit(0);
  //});
}

var conn, buffer, cb;
var sftp = function(cmd, cb) {
  conn = spawn('sftp', ['-q', '-b', '-', 'washington@scans.io']);
  buffer = "";
  conn.stdout.setEncoding('utf8');
  conn.stdin.setEncoding('utf8');
  conn.stderr.setEncoding('utf8');
  conn.stdout.on('data', function(data) {
    buffer += data;
  });
  conn.stderr.on('data', function(data) {
    console.log('SFTP STDERR:', data);
  });
  conn.stdin.on('STFP ERROR:', console.log.bind(console, 'stdin'));
  conn.on('exit',function() {
    delete conn;
    cb(buffer);
  });
  conn.stdin.end(cmd);
}


// Get local list.
var localArchives = fs.readdirSync('runs').filter(function(file) {
  return file.indexOf('.tgz') > 0;
});

// Wait for remote list
var remoteArchives = [];
var finalArchives = [];
sftp('cd data/dns/runs\nls', function(remote) {
  remoteArchives = remote.split('\n');
  remoteArchives.forEach(function(file) {
    if (file.indexOf('sftp>') === 0) {
      return;
    }
    file = file.trim();
    finalArchives.push(file);
    if (localArchives.indexOf(file) > -1) {
      localArchives.splice(localArchives.indexOf(file), 1);
    }
  });
  // Local Archives is now things to upload.
  var cmd = 'lcd runs\ncd data/dns/runs\n';
  var todo = 0;
  localArchives.forEach(function(file) {
    todo++;
    cmd += 'put ' + file + '\n';
    finalArchives.push(file);
  });
  console.log('Uploading Data [' + todo + ' files]...');
  sftp(cmd, finishMetaData.bind({}, finalArchives));
});

