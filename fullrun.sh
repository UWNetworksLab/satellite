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
  if [[ -n $(node ../util/config.js domainlist) ]]; then
    curl -s `node ../util/config.js domainlist` >> domains.txt
  fi
  rm top-1m.csv
  cd ..
}

##2. Add in redirects
addRedirects()
{
  echo "Learning Redirects..."
  node dns/find-redirects.js temp/domains.txt temp/extra
  cat temp/extra-uniqRedirects.txt >> temp/domains.txt
  rm temp/extra-uniqRedirects.txt
}

##3. Get the blacklist.
getBlacklist()
{
echo "Getting Blacklist..."
  if [[ -n $(node util/config.js blacklist) ]]; then
    curl -s `node util/config.js blacklist` > temp/blacklist.conf
  else
    echo "No blacklist set for satellite."
    echo "Configure this setting in the config.json file."
    echo "You'll need to set up your own blacklist or get in touch with us"
    echo "in order to use ours."
    exit 1
  fi
}

##4. Create output for run.
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
  `node util/config.js zmap` -p 53 -o runs/$thisRun/cs.washington.edu.csv \
    -b temp/blacklist.conf -c 300 -r `node util/config.js rate` \
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
  echo "Scanning all domains..."
  cp temp/domains.txt runs/${thisRun}-domains.txt
  cp temp/dns_servers.txt runs/${thisRun}-servers.txt
  node dns/managedscans.js temp/domains.txt temp/dns_servers.txt runs/$thisRun
}

##8. Record IP Ownership.
recordLookupTable()
{
  echo "Building ASN tables..."
  node asn_aggregation/makemap.js $thisRun runs/
}

##9. Run HTTP Scans.
runHTTPScans()
{
  echo "Scanning HTTP(s)..."
  mkdir runs/$thisRun-http
  node http/managedscans.js runs/$thisRun-http
}

##10. Archive
makeArchive()
{
  echo "Archiving..."
  tar -czf runs/$thisRun.tgz runs/$thisRun
  sha1sum runs/$thisRun.tgz | awk '{print $1}' > runs/$thisRun.tgz.sig
  node generateStudyMetadata.js
}

##11. Aggregate
aggregateRun()
{
  echo "Aggregating..."
  node dns/aggregator.js runs/$thisRun runs/$thisRun.lookup.json runs/$thisRun.asn.json
}

#12. Favicons
favicon()
{
  # TODO : Randomize domains and parallelize
  echo "Starting Favicons..."
  mkdir runs/$thisRun-favicon
  fp = runs/$thisRun-favicon
  echo "{}" > $fp/ignorelist.json
  node favicon/original.js temp/domains.txt $fp/domains-localvalidation.json
  node favicon/favicon.js runs/$thisRun.ip-domains.json $fp/ignorelist.json $fp/favicondomains.jsonlines
  node favicon/compare.js $fp/domains-localvalidation.json $fp/favicondomains.jsonlines runs/$thisRun.favicons.jsonlines
}

##12. Clean up
cleanup()
{
  echo "Cleaning up..."
  rm temp/dns_servers.txt
  rm -r runs/$thisRun
}


if [ $# -eq 0 ]
then
getTopSites          # downloads alexa.
addRedirects         # follow redirects and include in top sites.
getBlacklist         # downloads blacklist.
generateRun          # creates date-based folder
getActiveResolvers  # does cs.washington.edu run
getGoodHosts        # recreates dns_servers.txt from the cs.washington.edu run
runTopSites          # runs all top domains against dns_servers.txt
recordLookupTable    # Build lookup table of current bgp annoncements.
runHTTPScans         # scan ports 80 & 443
makeArchive          # creates archive.
aggregateRun         # replace folder with ASN aggreates.
favicon              # Favicon scan and compare
cleanup
else
  ${1}
fi
