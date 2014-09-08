#!/usr/bin/python

import sys
import re
import subprocess
import json
import shutil
from libs import *

def common():
	minifyCSS('public/css/app.css', [
		'source/css/bootstrap.min.css',
		'source/css/reactive.css',
		'source/css/styles.css',
		'source/css/nav.css'
	])

def dev():
	common()
	copy(items=[
		('source/html/index.html', 'public/index.html'),
		('source/static', 'public'),
		('source/js', 'public/js')
		])
	includeResources('public/index.html', [
		'css/app.css',
		'js/routing/util.js',
		'js/routing/promise.js',
		'js/routing/cache.js',
		'js/routing/simpleanimate.js',
		'js/routing/routing.js',
	])

def production():
	common()
	minifyJS('public/js/app.js', [
		'source/js/tools/beginClosure.js',
		'source/js/routing/util.js',
		'source/js/routing/promise.js',
		'source/js/routing/cache.js',
		'source/js/routing/simpleanimate.js',
		'source/js/routing/routing.js',
		'source/js/tools/endClosure.js',
		'source/js/app.js'
		])
	copy(items=[
		('source/html/index.html', 'public/index.html'),
		('source/static', 'public')
		])
	includeResources('public/index.html', [
		'css/app.css',
		'js/app.js',
		])
	optimizeHTML('public/index.html')

def clean():
	remove('public')
	mkdir('public')

def sync():
	rsyncTo('aaron@aaroncake.io:/web/dev')

if __name__ == '__main__':

	buildTargets = {
		'dev': dev, 
		'production': production,
		'clean': clean,
		'sync': sync
		}

	if len(sys.argv) < 2 or not all (target in buildTargets.keys() for target in sys.argv[1:]):
		path = os.path.relpath(__file__)
		print 'usage: {} <target> [<target>...]\n\t# where target is any of {}'.format(path, ', '.join(buildTargets.keys()))
		sys.exit(1)

	# assume the project root is one folder up from this script
	path = os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
	os.chdir(path)

	for target in sys.argv[1:]:
		buildTargets[target]()

	print 'Build succeeded.'



