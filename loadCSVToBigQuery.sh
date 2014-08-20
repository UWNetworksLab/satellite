# Inputs (parameters): The filename of exactly 1 zmap .csv output.
# 
# The input is uploaded and inserted into BigQuery.

var=$1

echo "Parsing $var into newline delimited JSON..."
node zmapCSVToNewlineJSON.js $var $var.jsonList
echo "Done. Gzipping $var.jsonList > $var.jsonList.gz..."
gzip < $var.jsonList > $var.jsonList.gz
echo "Done. Uploading gs://censor-watch/$var.jsonList.gz....."
gsutil cp $var.jsonList.gz gs://censor-watch/
echo "Done. Starting insert job on gs://censor-watch/$var.jsonList.gz..."
bq --nosynchronous_mode load --source_format NEWLINE_DELIMITED_JSON dns.resolutions gs://censor-watch/$(basename $var.jsonList.gz) ./schema.json
