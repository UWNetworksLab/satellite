Satellite: Mapping the Internet's Stars
=======================================

Satellite is an open platform for measuring the accessibility and presence of
websites on a regular basis. It consists of a zmap-based probing engine for both
HTTP and DNS requests, an aggregation pipeline for data processing, and a web
interface for interactive visualization.

Through this process we attempt to answer the high level question:
How much of the global view of a remote domain can we understand from a
single measurement machine?

We release the data we have collected using this platform at [scans.io](https://scans.io/study/washington-dns).

### How does Satellite Work? ###

The top level functions of satellite are documented in the `fullrun.sh` file,
which is generally scheduled as a cron. job. This script manages the following
process:

* Determine the list of domains of interest. Currently based off of the Alexa top 10,000 list.
* Determine the list of servers of interest. Uses zmap to scan all ipv4 addresses on port 53,
  and a filtering process to extract a diverse and stable set of servers to use for subsequent
  interactions.
* Query servers for domains of interest. A managed set of zmap runs. HTTP scans use a direct
  zmap query, while for efficiency the DNS scans use the custom [udp_multi](https://github.com/willscott/zmap/blob/dns_udp/src/probe_modules/module_udp_multi.c) zmap probing module.
* Aggregate results into more managable forms. Our initial aggregation converts from the raw
  packets received from remote hosts to the list of acceptable IPs seen from different remote
  machines. This produces a file that is much more amenable to further analysis.
* File management: Archiving retrieved data, performing backups, keeping a clean workspace.

### Installation ###

* Install [node/npm](https://nodejs.org/)
* Install [zmap](https://zmap.io/) with the [multi-udp](https://github.com/willscott/zmap) feature-branch.
* make sure it's runnable by the zmap user.
* ```git clone https://github.com/uwnetworkslab/satellite```
* ```cd satelite```
* ```npm install```
* Run ```cluster_correlation/correlation-distr/build-distr.sh``` (which needs build utils)
* Set up the config.json with appropriate values

### Contribution guidelines ###

* Attempt to pass eslint rules.
* Comment to a branch or fork and open a pull request for review.

### Contact ###

* Satellite <satellite@cs.washington.edu>
* Will Scott (https://wills.co.tt) <willscott@gmail.com>

#### Files ####

* *asn_aggregation* Contains scripts for compressing raw scans to ASN or Country level aggregates.
* *cluster_correlation* Contains scripts for clustering domains based on similar DNS responses.
* *dns* Contains scripts around dns specific packet generation & processing
* *favicon* Contains scripts for fetching favicon information to test if an IP serves a domain.
* *http* Contains scripts for testing whether IPs have servers on ports 443 and 80.
* *interference* Contains scripts for detecting anomalies in responses.
* *util* Contains general-purpose utility scripts for working with zmap.
* *runs* Contains raw data
* *temp* Contains downloaded files used during an active run.

* *fullrun.sh* Does a full satellite run!
* *generateStudyMetadata.js* Creates the .study file needed by scans.io, and uploads files
* *package.json* Lists node dependencies needed by the code.


#### Changelog ####

This attempts to keep track of the evolving Satellite code base, and explain
major changes as they occur.

* *10/20/2016* Improved interference analysis
* *07/13/2016* Better geolocation
* *03/31/2016* Extraction of NXdomain failures
* *02/15/2016* Better handling of failures to retrieve current blacklist
* *09/13/2015* Collection of WHOIS ownership records
* *08/03/2015* Collection of reverse PTR records
* *06/28/2015* Initial aggregation is performed in parallel by multiple cores, reducing time to ~10 hours.
