# Inputs (parameters): One or more zmap .csv outputs.
# 
# The inputs are uploaded and inserted into BigQuery.

for var in "$@"
do
  node parseIPsFromPackets.js $var $var.jsonList
  gzip < $var.jsonList > $var.jsonList.gz
  gsutil cp $var.jsonList.gz gs://censor-watch/
  node startInsertJob.js resolutions gs://censor-watch/$var.jsonList.gz
done
