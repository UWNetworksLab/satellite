#!/bin/bash

##-1. Sanity Check Environment.
sanityCheck()
{
  zmapPath=`node util/config.js zmap`
  zmapModules=$($zmapPath --list-probe-modules | grep udp_multi)
  if [ -z "$zmapModules" ]; then
    echo "Your zmap doesn't have the udp_multi probe module built.";
    exit 1
  fi
  if [ ! -f cluster_correlation/correlation-distr/bin64/chainedSolvers ]; then
    echo "You haven't compiled the clustering dependency."
    echo "Run cluster_correlation/correlation-distr/build-distr.sh"
    exit 1
  fi
}

##0. Notify and wait.
notify()
{
  echo "Sending Notification..."
  node util/notify.js
  touch scan_pending.lock
  sleep `node util/config.js notification_delay`
  if [ -f scan_pending.lock ];
  then
    echo "Beginning."
    rm scan_pending.lock
  else
    echo "Scan Canceled."
    exit 1
  fi
}

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
    if [[ $(node ../util/config.js domainlist) == /* ]]; then
      cat `node ../util/config.js domainlist` >> domains.txt
    else
      curl -s `node ../util/config.js domainlist` >> domains.txt
    fi
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
    if [[ $(node util/config.js blacklist) == /* ]]; then
      cp `node util/config.js blacklist` temp/blacklist.conf
    else
      curl -s `node util/config.js blacklist` > temp/blacklist.conf
    fi
  else
    echo "No blacklist set for satellite."
    echo "Configure this setting in the config.json file."
    echo "You'll need to set up your own blacklist or get in touch with us"
    echo "in order to use ours."
    exit 1
  fi
  if [ -s temp/blacklist.conf ]; then
    echo "blacklist set"
  else
    echo "blacklist is empty. that's bad."
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
  echo `node util/config.js local_ip` > runs/$thisRun/local.csv.ip
  node dns/mkpkt.js temp/query.pkt `node util/config.js local_address`
  echo "Running initial scan..."
  `node util/config.js zmap` -p 53 -o runs/$thisRun/local.csv \
    -b temp/blacklist.conf -c 300 -r `node util/config.js rate` \
    --output-module=csv -f saddr,timestamp-str,data \
    --output-filter="success = 1" -M udp \
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
  node --max-old-space-size=8192 asn_aggregation/makemap.js $thisRun runs/$thisRun/lookup.json
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
  cd compat; node ./generateStudyMetadata.js; cd ..;
}

##11. Aggregate
aggregateRun()
{
  echo "Aggregating..."
  plel=$(node util/config.js aggregation_processes)
  node util/plelSplit.js $plel runs/$thisRun/zmap runs/$thisRun/asn.json "node ./dns/aggregator.js #1 ./runs/$thisRun/lookup.json #2 ./runs/$thisRun/whitelist.json"
  cat runs/$thisRun/asn.json.* >> runs/$thisRun/asn.json
  rm runs/$thisRun/asn.json.*

  echo "Aggregating IP-Domain Counts..."
  node --max-old-space-size=8192 asn_aggregation/asn_collapse-classC_domains.js runs/$thisRun/asn.json runs/$thisRun/aggregate
  node --max-old-space-size=8192 asn_aggregation/asn_collapse-ip_domains.js runs/$thisRun/asn.json runs/$thisRun/aggregate.ip-domain.json runs/$thisRun/aggregate.domain-ip.json
}

##11 (alt). OONI aggregation.
aggregateRunWithOoni()
{
  echo "Aggregating..."
  plel=$(node util/config.js aggregation_processes)
  node --max-old-space-size=8192 compat/ooni.js $thisRun runs/$thisRun/ooni.header runs/$thisRun/ooni.footer
  node util/plelSplit.js $plel runs/$thisRun/zmap runs/$thisRun/asn.json "node ./dns/aggregator.js #1 ./runs/$thisRun/lookup.json #2 ./runs/$thisRun/whitelist.json"
  cat runs/$thisRun/asn.json.*[!ooni] >> runs/$thisRun/asn.json
  cat runs/$thisRun/ooni.header runs/$thisRun/asn.json.*.ooni runs/$thisRun/ooni.footer >> runs/$thisRun/ooni.json
  rm runs/$thisRun/asn.json.* runs/$thisRun/ooni.header runs/$thisRun/ooni.footer

  echo "Aggregating IP-Domain Counts..."
  node --max-old-space-size=8192 asn_aggregation/asn_collapse-classC_domains.js runs/$thisRun/asn.json runs/$thisRun/aggregate
  node --max-old-space-size=8192 asn_aggregation/asn_collapse-ip_domains.js runs/$thisRun/asn.json runs/$thisRun/aggregate.domain-ip.json runs/$thisRun/aggregate.ip-domain.json
}

##12. Get Reverse Lookups of IPs.
reverseLookup()
{
  echo "Looking up PTR Records..."
  node --max-old-space-size=8192 util/jsonkeystofile.js runs/$thisRun/aggregate.ip-domain.json runs/$thisRun/allIPs.txt
  node dns/find-ptrs.js runs/$thisRun/allIPs.txt runs/$thisRun/ptrs.json
  echo "Looking up Server headers..."
  node --max-old-space-size=8192 http/find-server.js runs/$thisRun/allIPs.txt runs/$thisRun/serverheaders.json
  #echo "Looking up WHOIS Records..."
  #node dns/find-whois.js runs/$thisRun/allIPs.txt runs/$thisRun/whois.json
}

#13. Favicons
favicon()
{
  # TODO : Randomize domains and parallelize
  echo "Starting Favicons..."
  mkdir runs/$thisRun/favicon
  fp = runs/$thisRun/favicon
  echo "{}" > $fp/ignorelist.json
  node favicon/original.js temp/domains.txt $fp/locally-resolved.json
  node favicon/favicon.js runs/$thisRun/aggregate.ip-domain.json $fp/ignorelist.json $fp/favicons.jsonlines
  node favicon/compare.js $fp/locally-resolved.json $fp/favicons.jsonlines $fp/validation.jsonlines
}

##14. Build CDN Mapping
buildMatrices()
{
  echo "Generating initial Similarity matrix..."
  node --max-old-space-size=8192 cluster_correlation/correlation-matrix.js runs/$thisRun/aggregate.domain-classC.json runs/$thisRun/similarity01
  for i in `seq 1 6`
  do
    echo "Regenerating matrix (iteration $(expr $i) of 6)..."
    node --max-old-space-size=8192 cluster_correlation/reweighting-table.js runs/$thisRun/aggregate.domain-classC.json runs/$thisRun/aggregate.classC-domain.json runs/$thisRun/similarity0$i runs/$thisRun/reweight0$i.json
    node --max-old-space-size=8192 cluster_correlation/correlation-matrix.js runs/$thisRun/aggregate.domain-classC.json runs/$thisRun/reweight0$i.json runs/$thisRun/similarity0$(expr $i + 1)
  done

  echo "Assigning Domains to clusters..."
  node --max-old-space-size=8192 cluster_correlation/correlation-distr/run-distr.js runs/$thisRun/similarity06  runs/$thisRun/clusters.json
  echo "Assigning IPs to clusters..."
  node --max-old-space-size=8192 cluster_correlation/cluster-footprint.js runs/$thisRun/clusters.json runs/$thisRun/aggregate.classC-domain.json runs/$thisRun/similarity07 runs/$thisRun/clusters.ips.json
  echo "Secondary Signal Aggregation [ptrs]"
  node --max-old-space-size=8192 cluster_correlation/merge_on_metadata.js runs/$thisRun/clusters.json runs/$thisRun/clusters.ips.json runs/$thisRun/ptrs.json 0.8 runs/$thisRuns/clusters.merged.json

  echo "Building Country-Country Lookup..."
  node --max-old-space-size=8192 asn_aggregation/asn_asn-to-country_country.js runs/$thisRun/lookup.json runs/$thisRun/asn.json runs/$thisRun/country-country.json
}

##15. Clean up
cleanup()
{
  echo "Cleaning up..."
  rm temp/dns_servers.txt
  rm -r runs/$thisRun/zmap
  rm runs/$thisRun/similarity0{2,3,4,5,6}.*
  rm runs/$thisRun/reweight0{1,2,3,4,5}.json
}


if [ $# -eq 0 ]
then
sanityCheck          # Checks to make sure environment is sane.
notify               # send email, wait 24hr to ensure not canceled.
getTopSites          # downloads alexa.
addRedirects         # follow redirects and include in top sites.
getBlacklist         # downloads blacklist.
generateRun          # creates date-based folder
getActiveResolvers   # does cs.washington.edu run
getGoodHosts         # recreates dns_servers.txt from the cs.washington.edu run
runTopSites          # runs all top domains against dns_servers.txt
recordLookupTable    # Build lookup table of current bgp annoncements.
#runHTTPScans        # scan ports 80 & 443 - not default
makeArchive          # creates archive.
aggregateRun         # replace folder with ASN aggreates.
reverseLookup        # do PTR lookups
#favicon             # Favicon scan and compare - not default.
buildMatrices        # build similarity table
cleanup
if [ -f postrun.sh ]
  then
    source postrun.sh
fi
node util/notify.js finished
else
  thisRun=${2}
  ${1}
fi
