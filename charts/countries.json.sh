#!/bin/sh
{ echo {; wget -qO- http://www.cidr-report.org/as2.0/bgp-originas.html | sed -rn -e "s/.*AS([0-9]+).*,([A-Z]{2})\$/'\1': '\2',/p"; echo }; } > countries.json
