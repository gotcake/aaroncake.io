#!/bin/bash

# check for root
if [ "$(id -u)" != "0" ]; then
	echo "Script must be run as root."
	exit 1
fi

if [ -z "$1" ]; then
	echo "Must provide the branch from which to update."
	exit 1
fi

rm /etc/nginx/sites-available/*
cp /web/$1/config/nginx-sites/* /etc/nginx/sites-available
service nginx reload