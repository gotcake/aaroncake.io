#!/bin/bash

# check for root
if [ "$(id -u)" != "0" ]; then
	echo "Script must be run as root."
	exit 1
fi

# verify that a branch name was passed in
if [ -z "$1" ]; then
	echo "Must specify the server mode to use."
	exit 1
fi

# update the nginx site for this branch
rm /etc/nginx/sites-enabled/*
cp /web/$1/config/nginx-sites/* /etc/nginx/sites-enabled

# reload nginx config
service nginx reload