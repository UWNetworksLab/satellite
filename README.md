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
````

#### Files ####

* asn_aggregation Contains scripts for compressing raw runs to ASN or Country level aggregates.
* asn_aggreagator.js - is used to take a folder of zmap scans and generate a .asn.json file with ip counts for each asn for each file. Order of 100 size reduction
* asn_zmap.js - is used to take a single zmap output csv and learn how many IPs responded in each ASN.
* filter.js - Takes a zmap DNS output and returns the IPs that appear to be valid DNS servers.
* fullrun.sh - Does a full satellite run!
* generateStudyMetadata.js - Creates the dns.study file needed by scans.io, and uploads files
* liner.js - A utility function to chunk a node.js stream into lines
* managedscans.js - Manages concurrent zmap scans. currently hardcoded for DNS
* mkpkt.js - Create a DNS query for a given domain.
* splithosts.js - Splits and filters hosts so that multiple scans can be done on different subsets.

