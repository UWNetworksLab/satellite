#!/bin/sh
# Remote zmap is a wrapper that allows zmap measurement commands to be run
# on an ssh-accessible computer.

set -e

ARGS=$@
ZMAP_HOST=`node util/config.js zmap_remote_host`
REMOTE_PATH=`node util/config.js zmap_remote_dir`
ZMAP_PATH=`node util/config.js zmap_remote_bin`

ssh $ZMAP_HOST "cd $REMOTE_PATH && $ZMAP_PATH $ARGS"
