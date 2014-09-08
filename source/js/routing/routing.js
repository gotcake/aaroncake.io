/*
 * routing.js
 * 
 * Routing is a library for building dynamic single page applications and
 * dynamically loading content, scripts, and styles. No dependancies. Supports
 * IE 8+.
 * 
 * @author Aaron Cake
 * 
 */
(function(){
    
    // some private variables
    var document = window.document, argSlice = Array.prototype.slice,
        documentHead = (document.head || document.getElementsByTagName('head')[0] /* IE 8 support */),
        promise = window.promise, asynclist = window.asynclist,
        ajaxCache = window.Cache && new Cache({ maxWeight: 1000000 });
    
    // onReady code adatpted from http://stackoverflow.com/a/9899701
    /**
     * Calls the given callback when the document is ready. (in the interactive, or complete states)
     * @param {function} cb the callback to call when the document is ready
     * @returns {undefined}
     */
    var onReadyCallback = (function() {
        // The public function name defaults to window.docReady
        // but you can pass in your own object and own function name and those will be used
        // if you want to put them in a different namespace
        var readyList = [],
            readyFired = false,
            readyEventHandlersInstalled = false;

        // call this when the document is ready
        // this function protects itself against being called more than once
        function ready() {
            if (!readyFired) {
                // this must be set to true before we start calling callbacks
                readyFired = true;
                for (var i = 0; i < readyList.length; i++) {
                    // if a callback here happens to add new ready handlers,
                    // the docReady() function will see that it already fired
                    // and will schedule the callback to run right after
                    // this event loop finishes so all handlers will still execute
                    // in order and no new ones will be added to the readyList
                    // while we are processing the list
                    readyList[i].fn.call(window, readyList[i].ctx);
                }
                // allow any closures held by these functions to free
                readyList = [];
            }
        }

        function readyStateChange() {
            if ( document.readyState === "complete" ) {
                ready();
            }
        }

        // This is the one public interface
        // docReady(fn, context);
        // the context argument is optional - if present, it will be passed
        // as an argument to the callback
        return function(callback, context) {
            // if ready has already fired, then just schedule the callback
            // to fire asynchronously, but right away
            if (readyFired) {
                setTimeout(function() {callback(context);}, 1);
                return;
            } else {
                // add the function and context to the list
                readyList.push({fn: callback, ctx: context});
            }
            // if document already ready to go, schedule the ready function to run
            if (document.readyState === "complete") {
                setTimeout(ready, 1);
            } else if (!readyEventHandlersInstalled) {
                // otherwise if we don't have event handlers installed, install them
                if (document.addEventListener) {
                    // first choice is DOMContentLoaded event
                    document.addEventListener("DOMContentLoaded", ready, false);
                    // backup is window load event
                    window.addEventListener("load", ready, false);
                } else {
                    // must be IE
                    document.attachEvent("onreadystatechange", readyStateChange);
                    window.attachEvent("onload", ready);
                }
                readyEventHandlersInstalled = true;
            }
        };
    })();
    
    /**
     * Checks to see if the given element is empty
     * @param {DOMElement} el
     * @returns {Boolean} true if el is empty
     */
    function elIsEmtpy(el) {
        return el.innerHTML.replace(/<!--.*-->/g,'').replace(/\s+/g,'') === '';
    }
    
    /**
     * Logs the given arguments, prefixed by "[routing.js] ".
     * @returns {undefined}
     */
    function log() {
        var args = argSlice.call(arguments, 0);
        if (typeof args[0] === 'string')
            args[0] = '[routing.js] ' + args[0];
        else
            args.shift('[routing.js] ');
        console.log.apply(console, args);
    }
    
    /**
     * Gets a normalized, absolute url for the given url
     * @param {string} path the url
     * @returns {string}
     */
    function normalizePath(path) {
        var a = document.createElement('a');
        a.href = path;
        return a.href;
    }
        
    /**
     * Creates a document fragment from an html string
     * @param {string} htmlStr a valid html string
     * @returns {document-fragment}
     */
    function createFragment(htmlStr) {
        var frag = document.createDocumentFragment(),
            temp = document.createElement('div');
        temp.innerHTML = htmlStr;
        while (temp.firstChild)
            frag.appendChild(temp.firstChild);
        return frag;
    }
    
    /**
     * Wraps a function which may be asynchronous. The function should
     * follow the following form:
     * 
     * function foo(arg1, arg2, callback) {
     *      // return a value to immediately complete the resuling promise
     *      // or call the callback with your value once it's ready
     * }
     * 
     * @param {type} fn the async function
     * @param {any} scope (optional) the scope in which to call the function
     * @returns {promise}
     */
    function wrapAsyncFn(fn, scope) {
        var p = new promise,
            args = argSlice.call(arguments, 2),
            ret;
        args.push(p.completeCb());
        ret = fn.apply(scope, args);
        if (ret !== undefined)
            p.complete(ret);
        return p;
    }
    
    /**
     * An object which handles registering and calling listeners for different events.
     * @constructor
     */
    function eventBus() {
        this.listeners = {};
        this.persistentEvents = {};
    }
    
    eventBus.prototype = {
        /**
         * Adds a listener for the given event if it is not already added
         * @param {string} event the event name
         * @param {function} fn the listener function
         * @param {any} scope (optional) the scope in which to call the listener function
         * @returns {undefined}
         */
        on: function(event, fn, scope) {
            if (!fn) return;
            var listeners = this.listeners,
                l = listeners[event] || (listeners[event] = []),
                found = false,
                persistentEvent = this.persistentEvents[event];
            eachArr(l, function(listener) {
                if (listener === fn || listener._origFn === fn) {
                   found = true;
                   return false;
               }
            });
            if (!found) {
                if (persistentEvent)
                    fn.apply(scope, persistentEvent);
                l.push(bind(fn, scope));
            }
        },
        /**
         * Removes a listener from an event
         * @param {string} event the event name
         * @param {function} fn the original function that was added as a listener
         * @returns {undefined}
         */
        un: function(event, fn) {
            if (!fn) return;
            var listeners = this.listeners[event];
            eachArr(listeners, function(listener, index) {
               if (listener === fn || listener._origFn === fn) {
                   listeners.slice(index, 1);
                   return false;
               }
            });
        },
        /**
         * Calls all of the listeners for a given event with the given arguments
         * @param {boolean} persistent (optional) true to make the event persistent
         * @param {string} event
         * @param {varargs} ... any arguments to pass to the listeners
         * @returns {undefined}
         */        
        fire: function(persistent, event) {
            var args;
            if (persistent === true) {
                args = argSlice.call(arguments, 2);
                this.persistentEvents[event] = args;
            } else {
                args = argSlice.call(arguments, 1);
                event = persistent;
            }
            var listeners = this.listeners[event];
            if (listeners) // unnecessary, but saves executing the function call
                eachArr(listeners, cbCallWith(args));
        }
    };
    
    /**
     * Serializes an object to a url-friendly query string
     * @param {object} obj the object to serialize
     * @param {string} prefix the prefix (for nested objects only)
     * @returns {String}
     */
    function queryString(obj, prefix) {
        var str = [];
        for(var p in obj) {
          var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
          str.push(typeof v === "object" ?
            queryString(v, k) :
            encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
        return str.join("&");
    }
    
    /**
     * Asyncronously makes an ajax request for the resource at the given url.
     * Returns data to the promise/callback as an object: 
     * {
     *    success: true if the server returned a 2xx or 304 code
     *    text: the response text
     *    xhr: the XMLHttpRequest object
     *    cached: true if the request data was cached
     * }
     * @param {string} url the url to request
     * @param {function} cb (optional) the callback to call when complete
     * @param {any} scope (optional) the scope in which to execure the callback
     * @returns {promise}
     */
    function ajax(url, cb, scope, config) {
        if (typeof url === 'object')
            config = url;
        if (config) {
            if (config.url)
                url = config.url;
            if (config.complete)
                cb = config.complete;
            if (config.scope)
                scope = config.scope;
        } else
            config = {};
        
        var p = new promise, r, o, 
            useCaching = !config.noCache,
            lastModified, 
            method = config.method || 'GET',
            dataAllowed = method === 'POST' || method === 'PUT',
            serializedParams = config.params && queryString(config.params),
            cacheKey = url,
            async = config.async !== false;
    
        if (serializedParams)
            cacheKey += (url.indexOf('?') > -1 ? '&' : '?') + serializedParams;
    
    
        // if not using a method that supports data, update the url with the parameters, if any
        if (!dataAllowed)
            url = cacheKey;
        
        if (config.headers)
            cacheKey += '#' + queryString(config.headers);
        
        if (cb)
            p.onComplete(cb, scope);
        
        if (useCaching) {
            o = ajaxCache.get(cacheKey);
            if (o) {
                o.cached = true;
                if (config.hardCache) {
                    p.complete(o);
                    return;
                }
                lastModified = o.xhr.getResponseHeader('Last-Modified');
            }
        }
        
        r = new XMLHttpRequest;
        r.onreadystatechange = function() {
            if (r.readyState === 4) {
                if (r.status >= 200 && r.status < 300) {
                    o = {
                        success: true,
                        text: r.responseText,
                        xhr: r
                    };
                    ajaxCache && ajaxCache.put(cacheKey, o, r.responseText.length);
                } else if (!r.status === 304 || !o) {
                    o = {
                        success: false,
                        text: r.responseText,
                        xhr: r
                    };
                }
                p.complete(o);
            }
        };
        r.open(method, url, async);
        if (dataAllowed && serializedParams)
            r.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        if (lastModified)
            r.setRequestHeader('If-Modified-Since', lastModified);
        eachObj(config.headers, function(val, name) {
            r.setRequestHeader(name, val);
        });
        r.send(dataAllowed ? serializedParams || config.data : null);
        return p;
    }
     
    /**
     * Preforms an ajax call after the deferring promise completes.
     * Returns a promise that completes when the ajax call completes.
     * If no deferring promise is given (falsish), the ajax call is made immediately.
     * @param {promise} deferingPromise the promise to wait on, if any
     * @param {string} url the url
     * @param {function} cb (optional) a function to call when complete
     * @param {any} scope (optional) the scope in which to execute the callback
     * @returns {promise}
     */
    function deferredAjax(deferingPromise, url, cb, scope, conf) {
        if (!deferingPromise)
            return ajax(url, cb, scope, conf);
        else {
            var p = new promise;
            deferingPromise.onComplete(function() {
               p.chain(ajax(url, cb, scope, conf)); 
            });
            return p;
        }   
    }
    
    // a slew of private variables
    var events = new eventBus, loadedScripts = {}, loadedCSS = {}, transitions = {},
        conf, contentPreProcessors = [], domPreProcessors = [], lastHash = null, lastParsedHash = null,
        targets = {}, docReady = false, routingInited = false, routing;
    
    /**
     * Checks to see if the style sheet is loaded, and if not, loads the style 
     * sheet and returns a promise that completes when the process is finished.
     * @param {string} url
     * @returns {promise}
     */
    function requireCSS(url, sync, deferingPromise) {
        var sheets, i=0, normPath = normalizePath(url);
        if (loadedCSS[normPath])
            return loadedCSS[normPath];
        sheets = document.querySelectorAll('link[rel="stylesheet"][href]');
        for (; i<sheets.length; i++)
            if (sheets[i].href === normPath)
                return promise.immediate();
        return loadedCSS[normPath] = deferredAjax(deferingPromise, normPath, function(r) {
            if (r.success) {
                var el = document.createElement('style');
                el.setAttribute('type', 'text/css');
                el.setAttribute('data-src', url);
                documentHead.appendChild(el);
                if (el.styleSheet) { // IE 8
                    el.styleSheet.cssText = r.text;
                } else {
                    el.appendChild(document.createTextNode(r.text));
                }
                if (conf.logCSSLoad)
                    log('Style sheet loaded: ' + url);
            } else {
                log('ERROR: Style sheet failed to load: ' + url);
            }
        }, null, {async: !sync});
    }
    
    /**
     * Checks to see if the script is loaded, and if not, loads the script
     * and returns a promise that completes when the process is finished.
     * @param {string} url
     * @returns {promise}
     */
    function requireScript(url, sync, deferingPromise) {
        var scripts, i=0, normPath = normalizePath(url);
        if (loadedScripts[normPath])
            return loadedScripts[normPath];
        scripts = document.querySelectorAll('script[src]');
        for (; i<scripts.length; i++)
            if (scripts[i].src === normPath) 
                return promise.immediate();
        return loadedScripts[normPath] = deferredAjax(deferingPromise, normPath, function(r) {
            if (r.success) {
                var el = document.createElement('script');
                el.setAttribute('type', 'text/javascript');
                el.setAttribute('data-src', url);
                if (isIElt9) {
                    el.text = r.text;
                } else {
                    el.appendChild(document.createTextNode(r.text));
                }
                documentHead.appendChild(el);
                if (conf.logJSLoad)
                    log('Script loaded: ' + url);
            } else {
                log('ERROR: Script failed to load: ' + url);
            }
        }, null, {async: !sync});
    }
    
    /**
     * Replaces ${n} in the input string with the nth part of the path. If n is 
     * not numeric, it is repaced with the value of the query parameter of the
     * same name. If the value does not exist, it is replaced with the empty string.
     * @param {object} parsedHash the parsed hash
     * @param {string} str the input string
     * @returns {string}
     */
    function replaceStringVars(parsedHash, str) {
        return str.replace(/\$\{[a-zA-Z0-9_\-]+}/, function(match) {
            var varName = match.substring(3, match.length - 2);
            if (!isNaN(varName) && parsedHash.path.length > parseInt(varName)) {
                // if a number, get the value from the path entry
                return parsedHash.path[parseInt(varName)];
            } else if (typeof parsedHash.params[varName] !== 'undefined') {
                // if it's a query key get the value from the query
                return parsedHash.params[varName];
            } else {
                return ''; // otherwise return the empty string
            }
        });
    }
    
    /**
     * Recursively processes the given content with each registered content
     * pre-processor that matches the given path. Returns a promise which 
     * completes with the processed content.
     * @param {string} path the url/path of the source of the content
     * @param {string} content the actual content
     * @returns {promise}
     */
    function preProcessContent(path, content, /*Do not use these args ->*/ index, p) {
        if (contentPreProcessors.length === 0) return promise.immediate(content);
        if (!p) p = new promise;
        if (!index) index = 0;
        var proc = contentPreProcessors[index];
        if (!proc.regex || proc.regex.test(path)) {
            wrapAsyncFn(proc.fn, proc.scope || window, content).onComplete(function(newContent) {
                if (index === contentPreProcessors.length - 1)
                    p.complete(newContent);
                else
                    preProcessContent(path, newContent, index+1, p);
            });
        } else if (index === contentPreProcessors.length - 1) {
            p.complete(content);
        }
        return p;
    }
    
    function preProcessDom(path, dom, /*Do not use these args ->*/ index, p) {
        if (domPreProcessors.length === 0) return promise.immediate();
        if (!p) p = new promise;
        if (!index) index = 0;
        var proc = domPreProcessors[index];
        if (!proc.regex || proc.regex.test(path)) {
            wrapAsyncFn(proc.fn, proc.scope || window, dom).onComplete(function() {
                if (index === domPreProcessors.length - 1)
                    p.complete();
                else
                    preProcessDom(path, dom, index+1, p);
            });
        } else if (index === domPreProcessors.length - 1) {
            p.complete();
        }
        return p;
    }
    
    /**
     * Compares two parsed hash objects to see if they are equal
     * @param {object} a one parsed hash object
     * @param {object} b another parsed hash object
     * @returns {boolean} true if they are equal
     */
    function parsedHashEqual(a, b) {
        if (a === null || a.path.length !== b.path.length) return false;
        var i, k;
        for (i=0; i<a.path.length; i++)
            if (a.path[i] !== b.path[i])
                return false;
        for (k in a)
            if (a[k] !== b[k])
                return false;
        for (k in b)
            if (a[k] !== b[k])
                return false;
        return true;
    }
    
    /**
     * Parses the url hash into an object by separating out query params
     * and path entries.
     * @returns {object} the parsed hash
     */
    function parseHash() {
        var hash = window.location.hash, 
                parsed = { path: [], params: {}, raw: hash }, parts, query, i, item;
        if (!hash || hash.length <= 1)
            return parsed;
        hash = hash.substring(hash[1] === '/' ? 2 : 1);
        parts = hash.split('?');
        hash = parts[0];
        query = parts[1];
        parsed.rawPath = '/' + hash;
        if (hash)
            parsed.path = hash.split('/');
        if (query) {
            parsed.rawQuery = query;
            parts = query.split('&');
            for (i=0; i<parts.length; i++) {
                item = parts[i].split('=');
                parsed.params[item[0]] = item.length > 1 ? item[1]: null;
            }
        }
        return parsed;
    }
    
    /**
     * Checks to see if the hash has changed, and if so, executes all targets
     * @returns {undefined}
     */
    function checkHashChanged() {
        var hash = window.location.hash, parsed;
        
        // if this is the first call and the hash is not set, set the hash to the
        // default initial path, if any
        //console.log('lastHash', lastHash, 'hash', hash, )
        if (lastHash === null && hash === '' && conf.defaultInitialPath) {
            window.location.replace('#' + conf.defaultInitialPath);
            hash = window.location.hash;
        }
        // check to see if the hash changed
        if (lastHash === null || lastHash !== hash) {
            parsed = parseHash();
            if (lastParsedHash === null || !parsedHashEqual(parsed, lastParsedHash)) {
                // if the hash has changed, execute and update the last hash and call listeners
                var path = hash && hash.substring(1), lastPath = lastHash && lastHash.substring(1);
                events.fire('pathChange', parsed, lastParsedHash);
                execute(path, parsed, lastPath, lastParsedHash).onComplete(function() {
                   events.fire('pathChangeComplete', parsed, lastParsedHash); 
                });
                lastParsedHash = parsed;
            }
            lastHash = hash;
        }
    }
    
    /**
     * A transition on a single element
     * @param {object} config
     * @param {type} el
     * @constructor
     */
    function transition(config, el, duration) {
        var me = this;
        me._out = config.out;
        me._in = config['in'] || config.transition;
        me._cancel = config.cancel;
        me._duration = duration;
        me._el = el;
        if (config.init)
            config.init.call(me);
    }
    
    transition.prototype = {
        _runOut: function() {
            var p, me = this;
            if (!elIsEmtpy(me._el) && me._out) {
                p = me._outPromise = new promise;
                me._out(me._el, me._duration, p.completeCb());
            } else {
                p = me._outPromise = promise.immediate();
            }
            return p;
        },
        _runIn: function(content) {
            var p = new promise, me = this;
            me._outPromise.onComplete(function() {
                me._in(me._el, content, me._duration, p.completeCb());
            }, me);
            return p;
        },
        _runCancel: function() {
            if (this._cancel)
                this._cancel(this._el);
        }
    };
    
    /**
     * Resolves a function or string to a transtion configuration
     * @param {type} currentPath the current hash path
     * @param {type} currentHash the current parsed hash
     * @param {type} lastPath the last hash path
     * @param {type} lastHash the last parsed hash
     * @param {string|function|object} trans the input configuration
     * @returns {object} the transition configuration or null
     */
    function resolveTransition(currentPath, currentHash, lastPath, lastHash, trans) {
        if (typeof trans === 'function')
            return resolveTransition(trans(currentPath, lastPath, currentHash, lastHash));
        if (typeof trans === 'string')
            return { type: trans, duration: conf.defaultTransitionDuration };
        return trans;
    }
    
    /**
     * Executes an outcome by loading any dependancies and loading content into
     * the target elements while managing the transitions.
     * @param {string} currentPath the current hash path (minus the # symbol)
     * @param {object} currentHash the current parsed hash object
     * @param {string} lastPath the last hash path (minus the # symbol)
     * @param {object} lastHash the last parsed hash object
     * @param {string} targetSelector the selector of the target
     * @param {array} els the target elements
     * @param {string|object|function} defaultTransition the default transition (if any)
     * @param {object|function} outcome the outcome defition
     * @returns {asynclist}
     */
    function executeOutcome(currentPath, currentHash, lastPath, lastHash,
                            targetSelector, el, defaultTransition, outcome) {
        
        var trans = resolveTransition(currentPath, currentHash, lastPath,
                        lastHash, outcome.transiton || defaultTransition),
            a = new asynclist, p = new promise, dom,
            retA = new asynclist, contentURL;
    
        // load javascript
        eachArr(outcome.js, function(js) {
            if (js instanceof Array) {
                var deferringPromise;
                eachArr(js, function(url) {
                    deferringPromise = requireScript(url, false, deferringPromise);
                });
                if (deferringPromise)
                    a.add(deferringPromise);
            } else {
                a.add(requireScript(js));
            }
        });

        // load css
        eachArr(outcome.css, function(css) {
           a.add(requireCSS(css)); 
        });

        // load and process content
        contentURL = replaceStringVars(currentHash, outcome.url);
        if (conf.logContentLoad)
            log('Loading content from ' + contentURL  + ' into target ' + targetSelector);
        ajax(contentURL, function(r) {
            if (r.success)
                preProcessContent(contentURL, r.text).onComplete(function(cont){
                    dom = createFragment(cont);
                    preProcessDom(contentURL, dom).chain(p);
                });
        });
        a.add(p);
        
        // cancel any previous animation and begin the out animation
        if (el._curTransition)
            el._curTransition._runCancel();
        if (trans && transitions[trans.type]) {
            var t = el._curTransition = new transition(transitions[trans.type], el, trans.duration);
            t._runOut();
        } else {
            delete el._curTransition;
        }
        
        a.end().onComplete(function() {
            
            // begin the in animtaions
            if (el._curTransition)
                retA.add(el._curTransition._runIn(dom).onComplete(function(){
                    delete el._curTransition;
                    if (conf.logContentLoad)
                        log('Content from ' + contentURL  + ' finished loading into target ' + targetSelector);
                    events.fire('contentLoaded', el, contentURL);
                }));
             else {
                el.innerHTML = '';
                el.appendChild(dom);
                if (conf.logContentLoad)
                    log('Content from ' + contentURL  + ' finished loading into target ' + targetSelector);
                events.fire('contentLoaded', el, contentURL);
             }
                    
            retA.end();
           
        }).timeout(7000, function() {
            log('ERROR: outcome execution timed out!');
        });
        
        return retA;
    }
    
    /**
     * Executes a target by finding the matching outcome and loading the propercontent.
     * @param {string} path the current hash path (minus the # symbol)
     * @param {object} parsedHash the current parsed hash object
     * @param {string} lastPath the last hash path (nimus the # symbol)
     * @param {object} lastHash the last parsed hash object
     * @param {object} targetDef the target definition
     * @param {string} selector the target selector
     * @returns {undefined}
     */
    function executeTarget(path, parsedHash, lastPath, lastHash, targetDef, selector) {
        var el = document.querySelector(selector), matchedOutcome;
        if (!el) {// if no elements are found
            log('Warning: element matching \'' + selector + '\' not found.')
            return promise.immediate(); // continue
        }
        if (typeof targetDef === 'function')
            matchedOutcome = targetDef(path, parsedHash);
        else {
            eachArr(targetDef, function(outcome) {
                if (outcome.regex.test(path)) {
                    matchedOutcome = outcome.config;
                    if (typeof matchedOutcome === 'function')
                        matchedOutcome = matchedOutcome(path, parsedHash);
                    if (conf.logOutcomeMatch)
                        log('Outcome ' + outcome.regex.source + '(' + (matchedOutcome.url || matchedOutcome) + ') matched for target ' + selector);
                    return false; // break
                }
            });
            if (!matchedOutcome)
                matchedOutcome = targetDef.otherwise || conf.defaultOtherwise;
            if (!matchedOutcome) {
                // TODO: What goes here?
            }  
        }
        if (targetDef.current !== path) {
            if (typeof matchedOutcome === 'string')
                matchedOutcome = {
                    url: matchedOutcome
                };
            if (matchedOutcome.js && !(matchedOutcome.js instanceof Array))
                matchedOutcome.js = [matchedOutcome.js];
            if (matchedOutcome.css && !(matchedOutcome.css instanceof Array))
                matchedOutcome.css = [matchedOutcome.css];
            var a = executeOutcome(path, parsedHash, lastPath, lastHash, selector, el,
                targetDef.transition || conf.defaultTransition, matchedOutcome);
            targetDef.current = path;
            return a;
        } else
            return promise.immediate();
    }
    
    /**
     * Check the path against any valid paths and redirect if necessary. Execute
     * each target against the path if valid
     * @param {string} path the current hash path (minus the # symbol)
     * @param {object} parsedHash the current parsed hash object
     * @param {string} lastPath the last hash path (nimus the # symbol)
     * @param {object} lastHash the last parsed hash object
     * @returns {undefined}
     */
    function execute(path, parsedHash, lastPath, lastHash) {
        
        // if valid paths are defined, check to see if the path if valid.
        // if not valid, redirect to the invalidRedirect page
        if (conf.validPaths !== null) {
            var match = false;
            eachArr(conf.validPaths, function(pathRegex, i) {
                if (!(pathRegex instanceof RegExp))
                    pathRegex = conf.validPaths[i] = new RegExp(pathRegex);
                if(pathRegex.test(path)) {
                    match = true;
                    return false;
                }
            });
            if (!match) { // redirect
                window.location.replace('#' + (conf.invalidRedirect || ''));
                return;
            }
        }
        var a = new asynclist;
        eachObj(targets, function(targetDef, selector) {
            var p = executeTarget(path, parsedHash, lastPath, lastHash, targetDef, selector)
            a.add(p);
        });
        return a;
    }
    
    onReadyCallback(function() {
        docReady = true;
        if (routingInited) {
            // start the hash checks which will execute the routes
            checkHashChanged();
            setInterval(checkHashChanged, 100);
        }
        events.fire(true, 'ready');
    });
    
    routing = window.routing = {
        on: bind(events.on, events),
        un: bind(events.un, events),
        addListener: bind(events.on, events),
        removeListener: bind(events.un, events),
        getHash: parseHash,
        config: {
            validPaths: null,
            //logCSSLoad: false,
            //logJSLoad: false,
            //logContentLoad: false,
            //logOutcomeMatch: false,
            //defaultTransition: null,
            initialDefaultPath: null,
            redirectInvalid: null,
            defaultTransitionDuration: 1000,
            defaultOtherwise: null
        },
        init: function(config) {
            if (!routingInited) {
                // copy the outcomes and processors to local variables and
                // delete them from the config object. We don't want them in the global config
                var outcomes = config.outcomes, procs = config.contentProcessors;
                delete config.outcomes;
                delete config.contentProcessors;
                // apply the config
                conf = routing.config;
                apply(conf, config)
                // add each of the outcomes
                eachObj(outcomes, function(config, selector) {
                    routing.addOutcome(selector, config);
                });
                // add each of the content processors
                eachObj(procs, function(fn, pattern) {
                    routing.addContentProcessor(pattern, fn);
                });
                // set the inited flag
                routingInited = true;
                if (docReady) {
                    // start the hash checks which will execute the routes
                    checkHashChanged();
                    setInterval(checkHashChanged, 100);
                }
            }
        },
        defineTransition: function(name, config) {
            transitions[name] = config;
        },
        addContentProcessor: function(pattern, fn) {
            if (typeof pattern === 'function') {
                contentPreProcessors.push({
                    regex: null,
                    fn: pattern
                });
            } else {
                contentPreProcessors.push({
                    regex:  pattern instanceof RegExp ? pattern : new RegExp(pattern),
                    fn: fn
                });
            }
        },
        addDomProcessor: function(pattern, fn) {
            if (typeof pattern === 'function') {
                domPreProcessors.push({
                    regex: null,
                    fn: pattern
                });
            } else {
                domPreProcessors.push({
                    regex:  pattern instanceof RegExp ? pattern : new RegExp(pattern),
                    fn: fn
                });
            }
        },
        addOutcome: function(targetSelector, pattern, config) {
            if (arguments.length === 2) {
                if (typeof pattern === 'function') {
                    targets[targetSelector] = pattern;
                } else {
                    eachObj(pattern, function(conf, pat) {
                        routing.addOutcome(targetSelector, pat, conf);
                    });
                }
            } else {
                var outcomes = targets[targetSelector] || (targets[targetSelector] = []);
                outcomes.push({
                    regex: pattern instanceof RegExp ? pattern : new RegExp(pattern),
                    config: config
                });
                // if routing is already inited, re-execute this target
                if (routingInited) {
                    var path = lastHash && lastHash.substring(1);
                    executeTarget(path, lastParsedHash, path, lastParsedHash, targets[targetSelector], targetSelector);
                }
            }
        },
        ajax: ajax,
        requireScript: requireScript,
        requireCSS: requireCSS
    };
    
})();


