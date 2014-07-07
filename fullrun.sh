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
	zmap -p 53 -o runs/$thisRun/cs.washington.edu.csv \
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
	while read p; do
		echo "Scanning ${p}..."
		getBlacklist
		node mkpkt.js query.pkt $p
		zmap -p 53 -o runs/$thisRun/$p.csv \
			-b blacklist.conf -w hosts.txt -c 300 -r 50000 \
			--output-module=csv -f saddr,timestamp-str,data \
			--output-filter="success = 1 && repeat = 0" -M udp \
			--probe-args=file:query.pkt 
	done <domains.txt
}

##8. Clean up
cleanup()
{
	echo "Cleaning up..."
	rm query.pkt || echo "no query pkt."
	rm hosts.txt
	#TODO: upload.
}

getTopSites
getBlacklist
generateRun
getActiveResolvers
getGoodHosts
runTopSites