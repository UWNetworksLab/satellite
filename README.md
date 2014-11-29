# README #

This repository automates collection of satellite monitoring probes.
Currently working on generalizing from DNS to handle more probe types.

### What is this repository for? ###

* Generating zmap-compatible probe packets
* filtering response to determine functioning hosts
* Creating reports & uploading / archiving them.

### How do I get set up? ###

* git clone
* npm install

### Contribution guidelines ###

* Run past Will or Adam

### Who do I talk to? ###

* Will Scott (https://wills.co.tt) <willscott@gmail.com>
* Adam Lerner <lerner@cs.washington.edu>


#### Notes ####

A sample zmap invocation should look similar to this:

```
    zmap -p 53 -b blacklist.conf -o zmaptrial.csv --output-module=csv -f saddr,timestamp-str,data --output-filter="success = 1 && repeat = 0" -M udp --probe-args=file:query.pkt 8.8.8.8
```

Upon updating the zmap binary, you will likely want to be able to run as not root.
This is done through:

```
    sudo setcap cap_net_raw,cap_net_admin=eip /usr/local/sbin/zmap
```

#### Files ####

* *asn_aggregation* Contains scripts for compressing raw scans to ASN or Country level aggregates.
* *dns* Contains scripts around dns specific packet generation & processing
* *util* Contains general-purpose utility scripts for working with zmap.
* *runs* Contains raw data
* *temp* Contains downloaded files used during scanning.

* *fullrun.sh* Does a full satellite run!
* *generateStudyMetadata.js* Creates the .study file needed by scans.io, and uploads files
* *package.json* Lists node dependencies needed by the code.

