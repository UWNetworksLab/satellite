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
  node dns/mkpkt.js temp/query.pkt `node util/config.js local_address`
  echo "Running initial scan..."
  `node util/config.js zmap` -p 53 -o runs/$thisRun/local.csv \
    -b temp/blacklist.conf -c 300 -r `node util/config.js rate` \
    --output-module=csv -f saddr,timestamp-str,data \
    --output-filter="success = 1 && repeat = 0" -M udp \
    --probe-args=file:temp/query.pkt
}

##6. extract good hosts
getGoodHosts()
{
  echo "Generating IP list..."
  node dns/filter.js runs/$thisRun/local.csv temp/dns_servers.txt
  node dns/filter.js runs/$thisRun/local.csv runs/$thisRun/whitelist.json json
}

##7. Do it!
runTopSites()
{
  echo "Scanning all domains..."
  cp temp/domains.txt runs/${thisRun}/domains.txt
  cp temp/dns_servers.txt runs/${thisRun}/servers.txt
  mkdir runs/${thisRun}/zmap
  node dns/managedscans.js temp/domains.txt temp/dns_servers.txt runs/$thisRun/zmap
}

##8. Record IP Ownership.
recordLookupTable()
{
  echo "Building ASN tables..."
  node asn_aggregation/makemap.js $thisRun runs/$thisRun/lookup.json
}

##9. Run HTTP Scans.
runHTTPScans()
{
  echo "Scanning HTTP(s)..."
  mkdir runs/$thisRun/http
  node http/managedscans.js runs/$thisRun/http
}

##10. Archive
makeArchive()
{
  echo "Archiving..."
  tar -czf runs/$thisRun/zmap.tgz runs/$thisRun/zmap
  sha1sum runs/$thisRun/zmap.tgz | awk '{print $1}' > runs/$thisRun/zmap.tgz.sig
  node compat/generateStudyMetadata.js
}

##11. Aggregate
aggregateRun()
{
  echo "Aggregating..."
  plel=$(node util/config.js aggregation_processes)
  node util/plelSplit.js $plel runs/$thisRun/zmap runs/$thisRun/asn.json "node ../dns/aggregator.js #1 ../runs/$thisRun/lookup.json #2 ../runs/$thisRun/local.csv"
  cat runs/$thisRun/asn.json.* >> runs/$thisRun/asn.json
  rm runs/$thisRun/asn.json.*
}

aggregateRunWithOoni()
{
  echo "Aggregating..."
  plel=$(node util/config.js aggregation_processes)
  node compat/ooni.js $thisRun runs/$thisRun/ooni.header runs/$thisRun/ooni.footer
  node util/plelSplit.js $plel runs/$thisRun/zmap runs/$thisRun/asn.json "node ./dns/aggregator.js #1 ./runs/$thisRun/lookup.json #2 ./runs/$thisRun/whitelist.json"
  cat runs/$thisRun/asn.json.*[!ooni] >> runs/$thisRun/asn.json
  cat runs/$thisRun/ooni.header runs/$thisRun/asn.json.*.ooni runs/$thisRun/ooni.footer >> runs/$thisRun/ooni.json
  rm runs/$thisRun/asn.json.* runs/$thisRun/ooni.header runs/$thisRun/ooni.footer
}

##__. Build Similarity Matrices
buildMatrices()
{
  echo "Generating Tables..."
  node asn_aggregation/asn_collapse-classC_domains.js runs/$thisRun/asn.json runs/$thisRun/aggregate

  echo "Generating initial Similarity matrix..."
  node cluster_correlation/correlation-matrix.js runs/$thisRun/aggregate.domain-classC.json runs/$thisRun/similarity01
  for i in `seq 1 6`
  do
    echo "Generating matrix revision $(expr $i + 1)..."
    node cluster_correlation/reweighting-table.js runs/$thisRun/aggregate.domain-classC.json runs/$thisRun/aggregate.classC-domain.json runs/$thisRun/similarity0$i runs/$thisRun/reweight0$i.json
    node cluster_correlation/correlation-matrix.js runs/$thisRun/aggregate.domain-classC.json runs/$thisRun/reweight0$i.json runs/$thisRun/similarity0$(expr $i + 1)
  done
}

#12. Favicons
favicon()
{
  # TODO : Randomize domains and parallelize
  echo "Starting Favicons..."
  mkdir runs/$thisRun/favicon
  fp = runs/$thisRun/favicon
  echo "{}" > $fp/ignorelist.json
  node favicon/original.js temp/domains.txt $fp/locally-resolved.json
  node favicon/favicon.js runs/$thisRun/aggregate.ip-domains.json $fp/ignorelist.json $fp/favicons.jsonlines
  node favicon/compare.js $fp/locally-resolved.json $fp/favicons.jsonlines $fp/validation.jsonlines
}

##13. Clean up
cleanup()
{
  echo "Cleaning up..."
  rm temp/dns_servers.txt
  rm -r runs/$thisRun/zmap
  rm runs/$thisRun/similarity0{1-5}
  rm runs/$thisRun/reweight0{1-5}
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
