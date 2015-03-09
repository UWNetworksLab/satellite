#!/bin/bash

##1. Get The alexa top sites.
getTopSites()
{
	echo "Getting top Sites..."
  cd temp
	curl -O http://s3.amazonaws.com/alexa-static/top-1m.csv.zip
	unzip top-1m.csv.zip
	rm top-1m.csv.zip
	cut -d "," -f 2 top-1m.csv | head -10000 > domains.txt
	rm top-1m.csv
  cd ..
}

##2. Get the blacklist.
getBlacklist()
{
	echo "Getting Blacklist..."
  if [ ! -f "authfile" ];
  then
    echo "No authentication file exists for using the UW satellite blacklist"
    echo "You'll need to set up your own blacklist or get in touch with us"
    echo "in order to use ours."
    exit 1
  fi
	local auth=$(cat authfile)
	curl -s -u $auth http://seahawk.cs.washington.edu:8080/blacklist.conf > temp/blacklist.conf
}

##3. Create output for run.
generateRun()
{
	echo "Starting new run..."
	thisRun=$(date +"%m-%d-%Y")
	mkdir runs/$thisRun
}

##5. Find active servers
getActiveResolvers()
{
	node dns/mkpkt.js temp/query.pkt cs.washington.edu
	echo "Running initial scan..."
	zmap -p 53 -i eth0 -o runs/$thisRun/cs.washington.edu.csv \
		-b temp/blacklist.conf -c 300 -r 100000 \
        `cat zmap.conf` \
		--output-module=csv -f saddr,timestamp-str,data \
		--output-filter="success = 1 && repeat = 0" -M udp \
		--probe-args=file:temp/query.pkt 
}

##6. extract good hosts
getGoodHosts()
{
	echo "Generating IP list..."
	node dns/filter.js runs/$thisRun/cs.washington.edu.csv temp/dns_servers.txt
}

##7. Do it!
runTopSites()
{
	echo "Splitting..."
  #splits into 10 partitions of roughly 200k hosts each.
	node util/splithosts.js temp/dns_servers.txt temp/hosts 10 
	echo "Scanning x10000..."
	node dns/managedscans.js temp/domains.txt temp/hosts runs/$thisRun
}

##8. Archive
makeArchive()
{
	echo "Archiving..."
	tar -czf runs/$thisRun.tgz runs/$thisRun
	sha1sum runs/$thisRun.tgz | awk '{print $1}' > runs/$thisRun.tgz.sig
	node generateStudyMetadata.js
}

##8. Clean up
cleanup()
{
	echo "Cleaning up..."
	#rm temp/dns_servers.txt
	rm -r temp/hosts
}

getTopSites          # downloads alexa.
getBlacklist         # downloads blacklist.
generateRun          # creates date-based folder
#getActiveResolvers  # does cs.washington.edu run
#getGoodHosts        # recreates hosts.txt from the cs.washington.edu run
runTopSites          # runs all top domains against hosts
makeArchive          # creates archive.
#cleanup
