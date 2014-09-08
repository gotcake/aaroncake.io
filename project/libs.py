import os
import subprocess
import re
import sys
from HTMLParser import HTMLParser
import shutil

class FileAggregator(object):

    def __init__(self, root, ext):
        self.root = root;
        self.ext = ext
        self.files = []

    def addDirectory(self, dir):
        for root, dirs, files in os.walk(self.path(dir)):
            for file in files:
                if file.endswith(ext) and not file.endswith('.min' + ext):
                     self.files.append(self.path(root, file))

    def addFile(self, file):
        self.files.append(self.path(file))

    def addFiles(self, files):
        for file in files:
            self.addFile(self.path(file))

    def addDirectories(self, dirs):
        for dir in dirs:
            self.addDirectory(dir)

    def path(self, p1, p2=None):
        if p2:
            return os.path.realpath(os.path.join(self.root, p1, p2))
        else:
            return os.path.realpath(os.path.join(self.root, p1))

    def filesAreNewerThan(self, file):
        if not os.path.exists(self.path(file)):
            return True
        modTime = os.path.getmtime(self.path(file))
        for f in self.files:
            if not os.path.exists(f) or modTime < os.path.getmtime(f):
                return True
        return False

    def getFileContentsItr(self):
        for f in self.files:
            if not os.path.exists(f):
                raise Exception("File '{}' does not exist.".format(f))
            elif os.path.isdir(f):
                raise Exception("File '{}' is a directory.".format(f))
            with open(f, 'r') as file:
                yield file.read()

    def writeContentsToStream(self, stream):
        #print 'Writing contents...'
        #print len(self.files)
        #print len([x for x in self.getFileContentsItr()])
        for contents in self.getFileContentsItr():
            try:
                #print 'Writing contents of length {}'.format(len(contents))
                stream.write(contents)
            except IOError as e:
                if e.errno == errno.EPIPE or e.errno == errno.EINVAL:
                    # Stop loop on "Invalid pipe" or "Invalid argument".
                    # No sense in continuing with broken pipe.
                    break
                else:
                    # Raise any other error.
                    raise

    def getFileContentsList(self):
        fileContents = []
        for f in self.files:
            if not os.path.exists(f):
                raise Exception("File '{}' does not exist.".format(f))
            elif os.path.isdir(f):
                raise Exception("File '{}' is a directory.".format(f))
            with open(f, 'r') as file:
                fileContents.append(file.read())
        return fileContents

    def getFileContents(self):
        return ''.join(self.getFileContentsList())

    def compressTo(self, outputFile, overrideTime=0, force=False):
        f = self.path(outputFile)  
        if self.filesAreNewerThan(f) or (overrideTime and os.path.getmtime(f) < overrideTime):
            print "{} is out of date. rebuilding...".format(outputFile)
            with open(f, 'w') as file:
                file.write(self.getFileContents())
        else:
            print "{} is up to date.".format(outputFile)


class JSCompressor(FileAggregator):

    def __init__(self, root):
        super(JSCompressor, self).__init__(root, '.js')

    def compressTo(self, outputFile, overrideTime=0, force=False):
        f = self.path(outputFile)

        if not (self.filesAreNewerThan(f) or (overrideTime and os.path.getmtime(f) < overrideTime)):
            if force:
                print 'force rebuling {}...'.format(outputFile)
            else:
                print "{} is up to date.".format(outputFile)
                return
        else:
            print "JS file \'{}\' is out of date. rebuilding...".format(outputFile)

        p2 = subprocess.Popen(['uglifyjs', '-', '-m', 'c', '-o', f], stdin=subprocess.PIPE)
        self.writeContentsToStream(p2.stdin)
        p2.stdin.close()
        p2.wait()
            



class CSSCompressor(FileAggregator):

    def __init__(self, root):
        super(CSSCompressor, self).__init__(root, '.css')

    def compressTo(self, outputFile, overrideTime=0, force=False):
        f = self.path(outputFile)
        if not (self.filesAreNewerThan(f) or (overrideTime and os.path.getmtime(f) < overrideTime)):
            if force:
                print 'force rebuling {}...'.format(outputFile)
            else:
                print "{} is up to date.".format(outputFile)
                return
        else:
            print "CSS file \'{}\' is out of date. rebuilding...".format(outputFile)

        p2 = subprocess.Popen(['cleancss', '-o', f], stdin=subprocess.PIPE)
        self.writeContentsToStream(p2.stdin)
        p2.stdin.close()
        p2.wait()

class HTMLOptimizer(HTMLParser):

    def __init__(self):
        self.tagStack = None
        self.lastStartTag = None
        self.outbuffer = None
        HTMLParser.__init__(self)

    def write(self, *args):
        for item in args:
            self.outbuffer.append(item)

    def writeLastStartTag(self, end=False):
        if self.lastStartTag:
            tag, attrs = self.lastStartTag
            self.write('<', tag)
            for attr in attrs:
                name, value = attr
                self.write(' ', name, '="', value, '"')
            if end:
                if tag == 'script':
                    self.write('></script>')
                else:
                    self.write('/>')
            else:
                self.write('>')
            self.lastStartTag = None
            return True
        return False

    def handle_starttag(self, tag, attrs):
        self.writeLastStartTag()
        self.tagStack.append(tag)
        self.lastStartTag = (tag, attrs)

    def handle_endtag(self, tag):
        if not self.writeLastStartTag(True):
            self.write('</', tag, '>')
        self.tagStack.pop()

    def currentTag(self):
        l = len(self.tagStack)
        return self.tagStack[l-1] if l > 0 else None

    def handle_data(self, data):
        data = data.strip()
        currentTag = self.currentTag()
        if currentTag != 'script' and currentTag != 'style':
            data = re.sub(r'\s+', ' ', data, flags=re.MULTILINE)
        if len(data) > 0:
            self.writeLastStartTag()
            self.write(data)

    def handle_decl(self, decl):
        self.writeLastStartTag()
        self.write('<!', decl, '>')

    def handle_comment(self, data):
        self.writeLastStartTag()
        data = data.strip()
        if re.match(r'\s*{/?includes}\s*', data) or re.search(r'<!\[endif\]', data):
            self.write('<!--', data, '-->')

    def handle_charref(self, name):
        self.writeLastStartTag()
        self.write('&', name, ';')

    def handle_entityref(self, name):
        self.writeLastStartTag()
        self.write('&', name, ';')

    def unknown_decl(self, data):
        self.writeLastStartTag()
        print 'Warning: found unknown declaration in html: \'{}\''.format(data)
        #self.write(data)

    def optimize(self, html):
        self.tagStack = []
        self.lastStartTag = None
        self.outbuffer = []
        self.feed(html)
        out = ''.join(self.outbuffer)
        self.outbuffer = None
        return out

def minifyCSS(outputFile, inputFiles):
    compressor = CSSCompressor('./')
    for file in inputFiles:
        if os.path.exists(file) and os.path.isdir(file):
            compressor.addDirectory(file)
        else:
            compressor.addFile(file)
    target_dir, name = os.path.split(outputFile)
    mkdir(target_dir)
    compressor.compressTo(outputFile)

def minifyJS(outputFile, inputFiles):
    compressor = JSCompressor('./')
    for file in inputFiles:
        if os.path.exists(file) and os.path.isdir(file):
            compressor.addDirectory(file)
        else:
            compressor.addFile(file)
    target_dir, name = os.path.split(outputFile)
    mkdir(target_dir)
    compressor.compressTo(outputFile)

def optimizeHTML(outputFile, inputFile=None):
    opt = HTMLOptimizer()
    if not inputFile:
        inputFile = outputFile
    with open(inputFile, 'r') as inFile:
        html = inFile.read()
    html = opt.optimize(html)
    target_dir, name = os.path.split(outputFile)
    mkdir(target_dir)
    with open(outputFile, 'w') as outFile:
        outFile.write(html)

def remove(*files):
    for file in files:
        if os.path.exists(file):
            if os.path.isdir(file):
                #print 'Removing directory tree \'{}\''.format(os.path.relpath(file))
                shutil.rmtree(file)
            else:
                #print 'Removing file \'{}\''.format(os.path.relpath(file))
                os.remove(file)

def _mkDir(path):
    #print '_mkDir {}'.format(path)
    sub, last = os.path.split(path)
    if sub != '/' and not os.path.exists(sub):
        _mkdir(sub)
    if not os.path.exists(path):
        os.mkdir(path)
    elif not os.path.isdir(path):
        raise IOError('Unable to create directory. {} already exists, but is not a directory.'.format(path))

def _copyDir(src, dst):
    #print '_copyDir {} to {}'.format(src, dst)
    target_base_dir = os.path.realpath(dst)
    if not os.path.basename(dst):
        target_base_dir = os.path.realpath(os.path.join(dst, os.path.basename(src)))
    def walkFn(arg, dir, names):
        #print 'walkFn {}, files: {}'.format(dir, ', '.join(names))
        dst_dir = os.path.join(target_base_dir, os.path.relpath(dir, src))
        for name in names:
            dst_file = os.path.join(dst_dir, name)
            src_file = os.path.join(dir, name)
            if os.path.isfile(src_file):
                _copyFile(src_file, dst_file)
    os.path.walk(src, walkFn, None)

def _copyFile(src, dst):
    target_dir, desired_name = os.path.split(dst)
    dst_file = dst if desired_name else os.path.join(target_dir, os.path.basename(src))
    if os.path.exists(dst_file) and os.path.isdir(dst_file):
        raise IOError('Unable to copy file. {} already exists, but is a directory.'.format(path))
    if not os.path.exists(target_dir):
        _mkDir(os.path.realpath(target_dir))
    #print 'Copying \'{}\' to \'{}\''.format(src, os.path.relpath(dst_file))
    shutil.copy(src, dst_file)

def _copySingle(src, dst):
    if os.path.exists(src):
        if os.path.isdir(src):
            _copyDir(src, dst)
        elif os.path.isfile(src):
            _copyFile(src, dst)
    else:
        print 'Warning: {} does not exist. Skipping copy.'.format(src)

def copy(items=None, src=None, dst=None):
    if src and dst:
        _copySingle(src, dst)
    if items:
        for (src, dst) in items:
            _copySingle(src, dst)

def mkdir(*dirs):
    for dir in dirs:
        if not os.path.exists(dir):
            _mkDir(os.path.realpath(dir))
        elif not os.path.isdir(dir):
            raise IOError('Unable to create directory. {} already exists, but is not a directory.'.format(dir))

def rsyncTo(remotePath, localPath=os.path.realpath('.'), exclusionsFile=None):
    """
    Syncs the files to a remote location.
    All parameters must be absolute paths.
    """
    print 'Syncing files from \'{}\' to \'{}\'... '.format(localPath, remotePath)
    sys.stdout.flush()
    args = ['rsync','-azO','--no-perms','--delete']
    if exclusionsFile:
        args.append('--exclude-from={}'.format(exclusionsFile))
    args.append('{}/'.format(localPath))
    args.append(remotePath)

    try:
        subprocess.check_call(args)
    except subprocess.CalledProcessError as e:
        raise Exception('Failed to sync files. rsync returned error code: {}'.format(e.returncode))

def includeResources(file, sources, includeComments=True):
    spliceText = []
    if includeComments:
        spliceText.append('\n<!-- {includes} -->')
    for source in sources:
        base, ext = os.path.split(source)
        if ext == 'js':
            spliceText.append('\n<script type="text/javascript" src="')
            spliceText.append(source)
            spliceText.append('"></script>')
        elif ext == 'css':
            spliceText.append('\n<link rel="stylesheet" type="text/css" href="')
            spliceText.append(source)
            spliceText.append('"/>')
    if includeComments:
        spliceText.append('\n<!-- {/includes} -->\n\n')

    spliceText = ''.join(spliceText)

    with open(file, 'r') as f:
        sourceContent = f.read()

    def rawReplacer(text):
        def replacer(match):
            return text
        return replacer

    outputText, numSubs = re.subn(r'\n?<!--\s*{includes}\s*-->.*<!--\s*{/includes}\s*-->\n*', rawReplacer(spliceText), sourceContent, 1)

    if numSubs == 0:
        outputText, numSubs = re.subn(r'</head>', rawReplacer(spliceText + '</head>'), sourceContent, 1)

        if numSubs == 0:
            outputText, numSubs = re.subn(r'<html>',  rawReplacer('<html><head>' + spliceText + '</head>'), sourceContent, 1)

            if numSubs == 0:
                raise BuildError('Unable to find location to insert build content in file \'{}\''.format(sourceFile))

    with open(file, 'w') as f:
        f.write(outputText)




