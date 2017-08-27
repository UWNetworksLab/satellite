#!/bin/sh
# Remote zmap is a wrapper that allows zmap measurement commands to be run
# on an ssh-accessible computer.

set -e

ARGS=$@
ZMAP_HOST=""
REMOTE_PATH=""
ZMAP_PATH=""

ssh $ZMAP_HOST "cd $REMOTE_PATH && $ZMAP_PATH $ARGS"
