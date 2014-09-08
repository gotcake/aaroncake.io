function asyncEventCombiner(threshold, handler) {
    this.threshold = threshold;
    this.handler = handler;
    this.lastFire = 0;
    this.executing = false;
    this.triggerRequested = false;
    this.timeout = null;
}

asyncEventCombiner.prototype = {
    trigger: function() {
        var now = new Date().getTime(), me = this;
        if (me.executing) {
            me.triggerRequested = true;
        } else if (now - me.lastFire >= me.threshold) {
            me.execute();
        } else if (!me.timeout) {
            setTimeout(function() {
                me.timeout = null;
                me.execute();
            }, me.threshold - now + me.lastFire);
        }
    },
    execute: function() {
        var me = this;
        if (!me.executing) {
            if (me.timeout) {
                clearTimeout(me.timeout);
                me.timeout = null;
            }
            me.triggerRequested = false;
            me.executing = true;
            me.lastFire = new Date().getTime();
            me.handler(function() {
                me.executing = false;
                if (me.triggerRequested) {
                    me.triggerRequested = false;
                    me.trigger();
                }
            });
        }
    }
};

var filterKeys = [
    [37, 40], // arrows
    33, // pageup
    34, // pagedown,
    20, // caps lock
    17, // ctrl
    35, // end
    18, // alt
    27, // esc
    [112, 123], // fn keys
    36, // home
    144, // num lock
    16, // shift
    91, // start
    45 // insert
];

var filterKeySet = {};
eachArr(filterKeys, function(item) {
    if (item instanceof Array) {
        for (var i = item[0]; i <= item[1]; i++)
            filterKeySet[i] = true;
    } else {
        filterKeySet[item] = true;
    }
});

var tempNodeRange = document.createRange();
function makeTreeWalker(node, range, compareType) {
    return document.createTreeWalker(
            node,
             NodeFilter.SHOW_TEXT,
            function(node) {
                if (range) {
                    tempNodeRange.selectNode(node);
                    return tempNodeRange.compareBoundaryPoints(compareType, range) < 1 ?
                            NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                } else return true;
            },
            false
            );
}

function copyChildren(from, to) {
    while (from.firstChild) {
        to.appendChild(from.removeChild(from.firstChild));
    }
}


var selection = document.getSelection();
function getSelRange() {
    if (selection.rangeCount > 0)
        return selection.getRangeAt(0);
    return null;
}

function clearSel() {
    selection.removeAllRanges();
}

function setSel(sc, so, ec, eo) {
    var range = document.createRange();
    selection.removeAllRanges();
    range.setStart(sc, so);
    range.setEnd(ec, eo);
    selection.addRange(range);
}

function makeParentClone(root, node, content) {
    var lastParent, baseParent, tmp;
    while (n.parentNode && n.parentNode !== line) {
        tmp = n.parentNode.cloneNode(false);
        if (lastParent)
            tmp.appendChild(lastParent);
        else
            baseParent = tmp;
        lastParent = tmp;
    }
}

function isChild(root, child) {
    while (child.parentNode) {
        if (child.parentNode === root)
            return true;
        child = child.parentNode;
    }
    return false;
}

function deleteText(line, from, to) {
    var walker = makeTreeWalker(line), tot = 0, len, n,
        hasTo = (typeof to !== 'undefined'), toRemove = [];
    while (walker.nextNode() && (!hasTo || tot < to)) {
        n = walker.currentNode;
        if (n.nodeType === 3) {
            len = n.length || 0;
            if (tot > from) {
                if (tot + len <= to)
                    toRemove.push(n);
                else
                    n.data = n.data.substring(tot + len - to);
            } else if (tot + len > from)
                n.data = n.data.substring(0, tot + len - from);
            tot += len;
        }
    }
    while (toRemove.length > 0) {
        n = toRemove.pop();
        n.parentNode.removeChild(n);
    }
}

function spaces(count) {
    var s = new Array(count);
    for (; count>=0; --count)
        s.push(' ');
    return s.join('');
}

function mkDiv(content) {
    var div = document.createDocumentFragment();
    //var div = document.createElement('div');
    //div.setAttribute('class', 'editor-line');
    //div.setAttribute('contenteditable', 'true');
    if (content)
        div.appendChild(document.createTextNode(content));
    return div;
}

function mkSpan(cls, content) {
    var text = document.createTextNode(content);
    if (!cls) return text;
    var span = document.createElement('span');
    span.setAttribute('class', 'token ' + cls);
    span.appendChild(text);
    return span;
}

function addToken(out, token) {
    if (out.length > 0 && out[out.length-1].type === token.type)
        out[out.length-1].text += token.text;
    else
        out.push(token);
}

function processTokens(out, tokens, offset) {
    var i=offset||0, t;
    for (; i<tokens.length; ++i) {
        t = tokens[i];
        if (typeof t === 'string')
            addToken(out, {type: null, text:t});
        else if (t.content instanceof Array) {
            if (t.content.length > 0) {
                addToken(out, {type: t.type, text:t.content[0]});
                processTokens(out, t.content, 1);
            }
        } else {
            addToken(out, {type: t.type, text:t.content});
        }
    }
}

try {
    document.execCommand("enableObjectResizing", false, false);
} catch (e) {
    
}

function min(a, b) {
    return a < b ? a : b;
}

routing.on('contentLoaded', function(el, url) {
    var editorEl = el.querySelector('pre.editor');
    if (editorEl)
        window.editor = new codeEditor(editorEl);
});

var codeEditor = window.codeEditor = function codeEditor(el) {
    el = this.el = typeof el === 'string' ? domQuery(el) : el;
    el.oncontrolselect = function(){return false;};
    this.tabEquiv = '    ';
    this.tabWidth = 4;
    //onEvent(el, 'keydown', this.onKeyDown, this);
    //onEvent(el, 'keyup', this.onKeyUp, this);
    //onEvent(el, 'keypress', this.onKeyPress, this);
    this.lang = el.getAttribute('data-lang');
    routing.requireScript('js/prism.js', true);
    routing.requireCSS('css/prism.css');
    this.setText(el.innerText || el.textContent);
};

codeEditor.prototype = {
    getText: function() {
        var text = [], i=0, lines = this.getLines();
        for (;i<lines.length;++i) {
            if (i > 0)
                text.push('\n');
            text.push(lines[i].innerText || lines[i].textContent);
        }
        return text.join('');
    },
    setText: function(text) {
        text = (text||'').replace(/\t/g, this.tabEquiv);
        console.log(text);
        //var cursor = this.getCursor(), i;
        var i;
        this.el.innerHTML = '';
        if (Prism.languages[this.lang]) {
            this.lines = [];
            var tokens = [], t, line = [], lineDiv = mkDiv(), lineSplits, a, split;
            processTokens(tokens, Prism.tokenize(text, Prism.languages[this.lang]));
            console.log(tokens);
            for (i=0;i<tokens.length;++i) {
                t = tokens[i];
                lineSplits = t.text.split('\n');
                for (a=0; a<lineSplits.length; ++a) {
                    if (a>0) {
                        this.el.appendChild(lineDiv);
                        this.el.appendChild(document.createTextNode('\n'));
                        //this.lines.push(line.join(''));
                        line = [];
                        lineDiv = mkDiv();
                    }
                    split = lineSplits[a];
                    line.push(split);
                    lineDiv.appendChild(mkSpan(t.type, split));
                }
           }
           if (line.length > 0) {
               //this.lines.push(line);
               this.el.appendChild(lineDiv);
           }
        } else {
            var lines = this.lines = text.split('\n');
            for (i=0; i<lines.length; ++i)
                this.el.appendChild(mkDiv(lines[i]));
        }
        //if (cursor)
            //this.setCursor(cursor);
    },
    getCursor: function() {
        var range = getSelRange();
        if (range) {
            var lines = this.getLines(), startLine = 0, endLine = lines.length, 
                startOffset = 0, endOffset = 0, walker, i, line, isInside = false,
                sc = range.startContainer, ec = range.endContainer;
            if (isChild(this.el, sc)) {
                isInside = true;
                for (i=0; i<lines.length; ++i) {
                    line = lines[i];
                    if (sc === line || isChild(line, sc)) {
                        startLine = i;
                        walker = makeTreeWalker(line, range, Range.START_TO_END);
                        while (walker.nextNode()) {
                            startOffset += walker.currentNode.length || 0;
                        }
                        startOffset += range.startOffset;
                        break;
                    }
                }
            }
            if (sc === ec && range.endOffset === range.startOffset) {
                endLine = startLine;
                endOffset = startOffset;
            } else if (isChild(this.el, ec)) {
                isInside = true;
                for (i=0; i<lines.length; ++i) {
                    line = lines[i];
                    if (ec === line || isChild(line, ec)) {
                        endLine = i;
                        walker = makeTreeWalker(line, range, Range.END_TO_END);
                        while (walker.nextNode()) {
                            endOffset += walker.currentNode.length || 0;
                        }
                        endOffset += range.endOffset;
                        break;
                    }
                }
            }
            return isInside ? {
                line: startLine,
                endLine: endLine,
                offset: startOffset,
                endOffset: endOffset,
                isRange: startLine !== endLine || startOffset !== endOffset
            } : null;
        } else {
            return null;
        }
    },
    setCursor: function(sel) {
        if (!sel) return clearSel();
        var lines = this.getLines(),
            sc = this.el, ec = 0,
            so = this.el, eo = 0,
            walker, tot, len;
        if (lines.length > 0 && sel.line < lines.length) {
            sc = lines[sel.line];
            walker = makeTreeWalker(sc);
            tot = 0;
            while (walker.nextNode() && tot < sel.offset) {
                sc = walker.currentNode;
                len = walker.currentNode.length || 0;
                so = min(sel.offset - tot, len);
                tot += len;
            } 
        }
        if (typeof sel.endLine === 'undefined') {
            setSel(sc, so, sc, so);
        } else {
            if (lines.length > 0 && sel.endLine < lines.length) {
                ec = lines[sel.endLine];
                walker = makeTreeWalker(ec);
                tot = 0;
                while (walker.nextNode() && tot < sel.endOffset) {
                    ec = walker.currentNode;
                    len = walker.currentNode.length || 0;
                    eo = min(sel.endOffset - tot, len);
                    tot += len;
                }
            }
            setSel(sc, so, ec, eo);
        }
    },
    getLines: function() {
        return this.el.querySelectorAll('div.editor-line');
    }
}