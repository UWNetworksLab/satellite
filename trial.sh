#!/bin/bash

zmap -p 53 -o zmaptrial.csv --output-module=csv -f saddr,timestamp-str,data --output-filter="success = 1 && repeat = 0" -M udp --probe-args=file:query.pkt 8.8.8.8
