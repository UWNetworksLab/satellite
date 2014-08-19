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

#### Setting up your authdata for Google Cloud ####

You'll need to create an appropriate authdata.json file to enable the scripts
to talk to Google Cloud Services (for uploading data to BigQuery) on your behalf.

Visit https://console.developers.google.com/, go to the project (e.g. censor-watch),
and click Credentials under API & Auth in the left hand sidebar.

Click "Create New Client ID", select "Service Account", and download the private key.
You'll need to convert it to a .pem with something like

    openssl pkcs12 -in <downloadedPrivateKey>.p12 -nodes -nocerts > <downloadedPrivateKey>.pem

And you probably also want to change its permissions to 600, since it's a private key:

    chmod 600 <downloadedPrivateKey>.pem

Now create `authdata.json` with the following contents:

    {
        "email": "<Client ID from Service Account>",
        "keyFile": "<Filename of PEM format private key>",
        "key": "<Key fingerprint>",
        "scopes": [
          "https://www.googleapis.com/auth/bigquery",
        ],
        "subject":  ""
    }

And you should be ready to roll with uploading to BigQuery.
