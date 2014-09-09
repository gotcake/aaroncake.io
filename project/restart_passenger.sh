#!/bin/bash

# verify that a branch name was passed in
if [ -z "$1" ]; then
	echo "Must specify the branch to update."
	exit 1
fi

# verify that a branch name was passed in
if [ -z "$2" ]; then
	echo "Must specify the server mode to use."
	exit 1
fi

cd /web/$1
passenger stop --pid-file /web/$1/tmp/passenger.pid
passenger start --socket /web/$1/tmp/passenger.socket --daemonize --user www-data --log-file /web/$1/log/passenger.log --pid-file /web/$1/tmp/passenger.pid --environment $2