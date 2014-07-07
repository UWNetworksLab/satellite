# README #

zmap DNS automates collection of satellite monitoring for the DNS probe.

### What is this repository for? ###

* Generating zmap dns probe packets
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

The zmap command line should look something like:

```
    zmap -p 53 -o zmaptrial.csv --output-module=csv -f saddr,timestamp-str,data --output-filter="success = 1 && repeat = 0" -M udp --probe-args=file:query.pkt 8.8.8.8
```