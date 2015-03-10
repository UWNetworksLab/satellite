# README #

This repository automates collection of satellite monitoring probes.
Activity is centered around the question: how much of the global state of
network interference can we infer from a single commodity machine?

### What is this repository for? ###

* Generating scanning experiments for zmap to run, and managing them
* Analysis & Aggregation of packet captures
* Visualization and insight into regionalized anomalies.

### Installation ###

* Install [zmap](https://zmap.io/), and [node/npm](https://nodejs.org/)
* git clone
* npm install

### Contribution guidelines ###

* Attempt to pass jslint as specified by the [brackets](https://brackets.io) editor.
* Comments should go in a branch or fork and then be pull requested for review.

### Contact ###

* Satellite <satellite@cs.washington.edu>
* Will Scott (https://wills.co.tt) <willscott@gmail.com>
* Adam Lerner <lerner@cs.washington.edu>

#### Files ####

* *asn_aggregation* Contains scripts for compressing raw scans to ASN or Country level aggregates.
* *dns* Contains scripts around dns specific packet generation & processing
* *util* Contains general-purpose utility scripts for working with zmap.
* *runs* Contains raw data
* *temp* Contains downloaded files used during scanning.

* *fullrun.sh* Does a full satellite run!
* *generateStudyMetadata.js* Creates the .study file needed by scans.io, and uploads files
* *package.json* Lists node dependencies needed by the code.

