#!/bin/bash

##1. Get The alexa top sites.
getTopSites()
{
	echo "Getting top Sites..."
	curl -O http://s3.amazonaws.com/alexa-static/top-1m.csv.zip
	unzip top-1m.csv.zip
	rm top-1m.csv.zip
	cut -d "," -f 2 top-1m.csv | head -10000 > domains.txt
	rm top-1m.csv
}

##2. Get the blacklist.
getBlacklist()
{
	echo "Getting Blacklist..."
	local auth=$(cat authfile)
	curl -s -u $auth http://seahawk.cs.washington.edu:8080/blacklist.conf > blacklist.conf
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
	node mkpkt.js query.pkt cs.washington.edu
	echo "Running initial scan..."
	zmap -p 53 -i eth0 -o runs/$thisRun/cs.washington.edu.csv \
		-b blacklist.conf -c 300 -r 50000 \
		--output-module=csv -f saddr,timestamp-str,data \
		--output-filter="success = 1 && repeat = 0" -M udp \
		--probe-args=file:query.pkt 
}

##6. extract good hosts
getGoodHosts()
{
	echo "Generating IP list..."
	node filter.js runs/$thisRun/cs.washington.edu.csv hosts.txt
}

##7. Do it!
runTopSites()
{
	echo "Splitting..."
	node splithosts.js 10 #splits into 10 partitions of roughly 200k hosts each.
	echo "Scanning x10000..."
	node managedscans.js $thisRun
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
	#rm hosts.txt
	rm -r hosts
	#TODO: upload.
}

getTopSites          # downloads alexa.
getBlacklist         # downloads blacklist.
generateRun          # creates date-based folder
#getActiveResolvers  # does cs.washington.edu run
#getGoodHosts        # recreates hosts.txt from the cs.washington.edu run
runTopSites          # runs all top domains against hosts
makeArchive          # creates archive.
#cleanup
