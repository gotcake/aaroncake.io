(function(window){var isIElt9 = (function() {
    var div = document.createElement("div");
    div.innerHTML = "<!--[if lt IE 9]><i></i><![endif]-->";
    return div.getElementsByTagName("i").length === 1;
})();

var domQueryAll = bind(document.querySelectorAll, document),
        domQuery = bind(document.querySelector, document);

function hasClass(el, cls) {
    return el.classList ? el.classList.contains(cls) :
            (' ' + el.className + ' ').indexOf(' ' + cls + ' ') > -1;
}

function addClass(el, cls) {
    el.classList ? el.classList.add(cls) :
            (' ' + el.className + ' ').indexOf(' ' + cls + ' ') > -1 
            || (el.className += ' ' + cls);
}

function fnChain(fn1, scope1, fn2, scope2) {
    return function() {
        return fn2.call(scope2, fn1.apply(scope1, arguments));
    };
}

function removeClass(el, cls) {
    if (el.classList) {
        el.classList.remove(cls);
    } else {
        var i = (' ' + el.className + ' ').indexOf(' ' + cls + ' '), s;
        if (i > -1) {
            s = el.className.split('');
            s.splice(i, cls.length);
            el.className = s.join('');
        }
    }
}

function fireEvent(el, etype) {
    if (typeof el === 'string')
        el = domQueryAll(el);
    if (!(el instanceof Array || el instanceof NodeList))
        el = [el];
    eachArr(el, function(e) {
        if (!e)
            return;
        if (document.createEvent) {
            var evObj = document.createEvent('Events');
            evObj.initEvent(etype, true, false);
            e.dispatchEvent(evObj);
        } else {
            try {
                e.fireEvent('on' + etype, document.createEventObject());
            } catch(ex) {}
        }
    });

}

function onEvent(el, etype, fn, scope) {
    if (typeof el === 'string')
        el = domQueryAll(el);
    if (!(el instanceof Array || el instanceof NodeList))
        el = [el];
    eachArr(el, function(e) {
        if (!e)
            return;
        if (e.addEventListener) {
            e.addEventListener(etype, bind(fn, scope), false);
        } else {
            e.attachEvent('on' + etype, bind(fn, scope), false);
        }
    });
}


/**
 * Binds a function to the given scope. If no scope is passed in, the
 * given function is just returned as is. If a scope is bound, the orignal
 * function is stored in the _origFn property of the output function.
 * @param {function} fn the function
 * @param {any} scope (optional) the scope to bind the function to
 * @returns {function}
 */
function bind(fn, scope) {
    if (!scope)
        return fn;
    var ret;
    if (fn.bind)
        ret = fn.bind(scope);
    else
        ret = function() {
            return fn.apply(scope, arguments);
        };
    ret._origFn = fn;
    return ret;
}

/**
 * Creates a callback which will call the function passed to it as it's
 * first parameter with the given arguments
 * @param {array} args an array of arguments to call the function with
 * @returns {function}
 */
function cbCallWith(args) {
    return function(fn) {
        return fn.apply(window, args || []);
    };
}


/**
 * Loops over the items in an array and calls a function
 * for each index/value. The value is passed in as the first parameter
 * and the index as the second.
 * @param {array} a the array to loop over
 * @param {function} fn the function to call
 * @param {any} scope (optional) the scope in which to call the function
 * @returns {undefined}
 */
function eachArr(a, fn, scope) {
    if (a)
        for (var i = 0; i < a.length; i++)
            if (fn.call(scope, a[i], i) === false)
                break;
}

/**
 * Applies all of the properties from b to a
 * @param {object} a the object to apply the properties to
 * @param {object} b the object with the properties to apply
 * @returns {object} a
 */
function apply(a, b) {
    for (var k in b)
        a[k] = b[k];
    return a;
}

/**
 * Gets the properties of an object
 * @param {object} obj the object to get the properties of
 * @returns {array[string]}
 */
function getOwnProps(obj) {
    if (Object.getOwnPropertyNames)
        return Object.getOwnPropertyNames(obj);
    var names = [];
    for (var key in obj)
        names.push(key);
    return names;
}

/**
 * Loops over the properties of an object and calls a function
 * for each key-value pair. The value is passed in as the first parameter
 * and the key as the second.
 * @param {object} o the object to loop over
 * @param {function} fn the function to call
 * @param {any} scope (optional) the scope in which to call the function
 * @returns {undefined}
 */
function eachObj(o, fn, scope) {
    if (o)
        for (var k in o)
            if (fn.call(scope, o[k], k) === false)
                break;
}

// export functions into public module
window.util = {
    apply: apply,
    domQueryAll: domQueryAll,
    domQuery: domQuery,
    hasClass: hasClass,
    addClass: addClass,
    fnChain: fnChain,
    removeClass: removeClass,
    fireEvent: fireEvent,
    onEvent: onEvent,
    bind: bind,
    cbCallWith: cbCallWith,
    getOwnProps: getOwnProps,
    eachObj: eachObj,
    eachArr: eachArr,
    isIElt9: isIElt9
};
(function() {
    
   /**
     * An object which can take multiple listeners
     * that will be called when the promise is completed with
     * any data was passed in
     * @constructor
     */
    var promise = window.promise = function() {
        this.listeners = [];
        this.hasTimedOut = false;
        this.isComplete = false;
    };
    
    promise.prototype = {
        /**
         * Calls the given function at some point in the future when the promise
         * is completed. If the promise is already complete, the function
         * will be called immediately
         * @param {fucntion} cb a function to call when the promise is completed
         * @param {any} scope (optional) the scope to execute the function in
         * @returns {promise} this object
         */
        onComplete: function(cb, scope) {
            if (cb) {
                var me = this;
                if (!me.isComplete)
                    me.listeners.push(bind(cb, scope));
                else
                    bind(cb, scope)(me.data);
            }
            return me;
        },
        /**
         * Completes the promise, sets the data, and calls all complete listeners
         * If the promise is already complete, nothing is done.
         * @param {any} data (optional) the data to pass to the complete listeners
         * @param {boolean} force true to force the promise to complete even after a timeout
         * @returns {promise} this object
         */
        complete: function(data, force) {
            var me = this;
            if (!me.isComplete && (force || !me.hasTimedOut)) {
                me.isComplete = true;
                me.data = data;
                me.cancelTimeouts();
                eachArr(me.listeners, cbCallWith([me.data]));
            }
            return me;
        },
        
        
        /**
         * Calls the given function if the promise does not complete within
         * the given time frame. Once the timeout has been reached, the promise
         * will not complete except though calling the forceComplete method.
         * @param {integer} time the time in milliseconds to wait
         * @param {function} fn the function to call
         * @param {any} scope (optional) the scope in which to execute the function
         * @returns {promise} this object
         */
        timeout: function(time, fn, scope) {
            return this.after(time, function(me) {
                me.hasTimedOut = true;
                if (fn)
                   fn.call(this, me);
                me.cancelTimeouts();
            }, scope);
        },
        
        /**
         * Clears all timeouts from timeout or after so that they will no longer complete
         * @returns {promise} this object
         */
        cancelTimeouts: function() {
            eachObj(this.timeouts, function(v, timeout) {
                if (timeout)
                    clearTimeout(timeout);
            });
            delete this.timeouts;
            return this;
        },
        
        /**
         * Calls the given function if the promise does not complete within
         * the given time frame. Does not keep the asynclist from completing
         * @param {integer} time the time in milliseconds to wait
         * @param {function} fn the function to call
         * @param {any} scope (optional) the scope in which to execute the function
         * @returns {promise} this object
         */
        after: function(time, fn, scope) {
            if (!fn) return;
            var me = this,
                timeouts = me.timeouts || (me.timeouts = {});
            if (!me.isComplete) {
                var timeout = setTimeout(function() {
                    delete timeouts[timeout];
                    fn.call(scope, me);
                }, time);
                timeouts[timeout] = true;
            }
            return me;
        },
        
        /**
         * Returns a function that calls complete on this promise when called
         * @returns {function}
         */
        completeCb: function() {
            return bind(this.complete, this);
        },
        
        /**
         * Chains another promise to this one such that when the given promise
         * completes, so does this promise.
         * @param {promise} promise the promise to rely on
         * @returns {promise} this object
         */
        depend: function(promise) {
            promise.onComplete(this.completeCb());
            return this;
        },
        
        /**
         * Chains another promise to this one such that when the given promise
         * completes, so does this promise.
         * @param {promise} promise the promise to rely on
         * @returns {promise} this object
         */
        chain: function(promise) {
            this.onComplete(promise.completeCb());
            return this;
        }
    };
    
    /**
     * Returns a promise which is already completed
     * @returns {promise}
     */
    promise.immediate = function(data) {
        return (new promise).complete(data);
    };
    
    /**
     * An object which encapsulates multiple promises
     * @constructor
     */
    var asynclist = window.asynclist = function() {
        var me = this;
        me.completeCount = 0;
        me.listeners = [];
        me.hasTimedOut = false;
        me.isComplete = false;
        me.deferCount = 0;
        me.ended = false;
        me.data = [];
        if (arguments.length > 0)
            me.add.apply(me, arguments);
    };
    
    apply(asynclist.prototype = new promise(), {
        
        /**
         * Adds a promise to this asynclist. The asynclist will not complete 
         * until the added promise(s) complete.
         * @param {promise|array|varargs} promise the promise or promises to add to this list
         * @returns {asynclist} this object
         */
        add: function (prom) {
            var me = this;
            if (arguments.length > 1)
                prom = Array.prototype.slice.call(arguments, 0);
            if (prom instanceof Array) {
                eachArr(prom, function(p) {
                    me.add(p);
                });
            } else if (prom instanceof promise) {
                var dataIndex =  me.deferCount++;
                prom.onComplete(function(data) {
                    me.data[dataIndex] = data;
                    if (++me.completeCount === me.deferCount && me.ended) {
                        me.complete(me.data);
                    }
                });
            } else {
                throw "argument is not a promise";
            }
            return me;
        },
        
        /**
         * Signals that all of the promises have been added.
         * @returns {asynclist} this object
         */
        end: function() {
            var me = this;
            me.ended = true;
            if (!me.isComplete && me.completeCount === me.deferCount) {
                me.complete(me.data);
            }
            return me;
        }
        
    });
    
})();
(function() {

function _binaryFind(arr, date, imin, imax) {
    while (imax > imin) {
        var imid = ((imin + imax)/2)|0;
        if (arr[imid].e === date)
            return imid;
        else if (arr[imid].e < date)
            imin = imid + 1;
        else
            imax = imid - 1;
    }
    if (imax < 0)
        return 0;
    if (arr[imax].e < date)
        return imax+1;
    return imax;
}

function binaryFind(arr, date) {
    return _binaryFind(arr, date, 0, arr.length - 1);
}

function binaryInsert(array, item) {
    array.splice(_binaryFind(array, item.date, 0, array.length - 1), 0, item);
}

function removeSorted(array, item) {
    var i = binaryFind(array, item.e);
    while (i < array.length && array[i].e === item.e)
        if (array[i] === item)
            array.splice(i, 1);
        else
            i++;
}

function linkedListAppend(list, node) {
    if (list.t) {
        list.t.n = node;
        node.p = list.t;
    }
    list.t = node;
    if (!list.h)
        list.h = node;
}

function linkedListRemove(list, node) {
    if (node.p)
        node.p.n = node.n;
    if (node.n)
        node.n.p = node.p;
    if (list.h === node)
        list.h = node.n;
    if (list.t === node)
        list.t = node.p;
}

function linkedListPop(list) {
    var node = list.h;
    list.h = list.h.n;
    list.h.p = null;
    return node;
}

var Cache = window.Cache = function Cache(config) {
    var me = this;
    me.expiryOrder = [];
    me.useOrder = {};
    me.cache = {};
    me.maxWeight = config.maxWeight || 100;
    if (config.maxAge)
        me.maxAge = config.maxAge;
    me.curWeight = 0;
};

Cache.prototype = {
    get: function(key) {
        var me = this, o = me.cache[key];
        if (!o)
            return null;
        if (o.e) {
            var now = new Date().getTime();
            if (o.e <= now) {
                removeSorted(me.expiryOrder, o);
                // clean up the linked list
                linkedListRemove(me.useOrder, o);
                // delete it from the cache
                delete me.cache[key];
                return null;
            }
        }
        return o.v;
    },
    put: function(key, val, weight, maxAge) {
        weight = weight || 1;
        var me = this, o = me.cache[key], now = new Date().getTime();
        if (o) {
            var oldExpiry = o.e;
            o.e = (maxAge || me.maxAge) ? (maxAge || me.maxAge) + now : null;
            if (oldExpiry !== o.e)
                me.expiryOrder.sort(); // should be near O(log n) for best case nearly sorted
            linkedListRemove(me.useOrder, o);
            linkedListAppend(me.useOrder, o);
            me.curWeight += weight - o.w;
            o.w = weight;
            o.v = val;
        } else {
            if (me.curWeight + weight > me.maxWeight) {
                me.clean(now);
                while (me.curWeight + weight > me.maxWeight && (o = linkedListPop(me.useOrder))) {
                    me.curWeight -= o.w;
                    if (o.e)
                        removeSorted(me.expiryOrder, o);
                    // delete it from the cache
                    delete me.cache[key];
                }
            }
            o = me.cache[key] = {
                v: val,
                k: key,
                w: weight,
                e: (maxAge || me.maxAge) ? (maxAge || me.maxAge) + now : null,
            };
            if (o.e)
                binaryInsert(me.expiryOrder, o);
            linkedListAppend(me.useOrder, o);
            me.curWeight += weight;
        }
    },
    
    remove: function(key) {
        var o = this.cache[key];
        if (o) {
            // remove the expiry entry
            if (o.e)
                removeSorted(this.expiryOrder, o);
            // clean up the linked list
            linkedListRemove(this.useOrder, o);
            // delete it from the cache
            delete this.cache[key];
        }
    },
    clean: function(date) {
        var i = 0, me = this, eo = me.expiryOrder, removed, o;
        date = date || new Date().getTime();
        
        while(i<eo.length && eo[i].e < date) 
            i++;
        
        removed = eo.splice(0, i);
        while(i>0) {
            i--;
            o = removed[i];
            me.curWeight -= o.w;
            // clean up the linked list
            linkedListRemove(me.useOrder, o);
            // delete it from the cache
            delete me.cache[o.k];
        }
    },
    clear: function() {
        this.cache = {};
        this.useOrder = {};
        this.expiryOrder = [];
    }
};

})();/*
 * simpleanimate.js
 * 
 * Provides basic programatic CSS3 animation with fallback to pure javascript.
 * Does not provide any queuing. Multiple separate animations cannot be run on
 * any given element without breaking.
 * 
 */
(function() {

    var window = this, document = window.document, cssPrefixCache = {},
        promise = window.promise;

    /**
     * Gets the properly prefixed version of the given property
     * @param {string} base the base property
     * @returns {string} the propertly prefixed (or not) property
     */
    function getPrefixedCssProp(base) {
        base = base.replace(/-([a-zA-Z])/g, function(m, l) {
            return l.toUpperCase();
        });
        if (cssPrefixCache[base])
            return cssPrefixCache[base];
        var p = document.createElement('p'), style = p.style;
        if (typeof style[base] === 'string') {
            cssPrefixCache[base] = base;
            return base;
        }
        var prefixes = ['Moz', 'webkit', 'Webkit', 'Khtml', 'O', 'ms'], i = 0, str;
        base = base.charAt(0).toUpperCase() + base.substr(1);
        for (; i < prefixes.length; ++i) {
            str = style[prefixes[i] + base];
            if (typeof str === 'string') {
                cssPrefixCache[base] = str;
                return str;
            }
        }
        return null;
    }

    /**
     * Gets the current style property of the the given element
     * @param {type} el the element
     * @param {type} styleProp the style property to get
     * @returns {string} the current style property
     */
    function getStyle(el, styleProp) {
        var value, defaultView = (el.ownerDocument || document).defaultView;
        // W3C standard way:
        if (defaultView && defaultView.getComputedStyle) {
            // sanitize property name to css notation
            // (hypen separated words eg. font-Size)
            styleProp = styleProp.replace(/([A-Z])/g, "-$1").toLowerCase();
            return defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
        } else if (el.currentStyle) { // IE
            // sanitize property name to camelCase
            styleProp = styleProp.replace(/\-(\w)/g, function(str, letter) {
                return letter.toUpperCase();
            });
            value = el.currentStyle[styleProp];
            // convert other units to pixels on IE
            if (/^\d+(em|pt|%|ex)?$/i.test(value)) {
                return (function(value) {
                    var oldLeft = el.style.left, oldRsLeft = el.runtimeStyle.left;
                    el.runtimeStyle.left = el.currentStyle.left;
                    el.style.left = value || 0;
                    value = el.style.pixelLeft + "px";
                    el.style.left = oldLeft;
                    el.runtimeStyle.left = oldRsLeft;
                    return value;
                })(value);
            }
            return value;
        }
    };

    var css3TranitionProp = getPrefixedCssProp('transition');

    // if css3 transitions are available, use them
    // otherwise fallback to frame-based/timeout-based animation
    if (css3TranitionProp) {
        
        // css3 transition based implementation
        window.simpleAnimate = function(conf) {
            var i = 0, el = conf.el,
                    duration = typeof conf.duration === 'undefined' ? 1000 : conf.duration,
                    timeout, delayTimeouts = {};
            
            if (typeof el === 'string')
                el = document.querySelector(el);
            
            var transStr = '', maxDuration = 0,
                stoppedOrComplete = false, prom = new promise();
            
            if (typeof conf.complete === 'function')
                prom.onComplete(conf.complete, conf.scope);
            
            if (stoppedOrComplete) return; // don't do anything if the animation was stopped
            // buld up the css transition string
            eachObj(conf.props, function(propDef, prop) {
                function afterDelay() {
                    if (delayTimeouts[prop])
                        delete delayTimeouts[prop];
                    var propPre = getPrefixedCssProp(prop),
                        propDur = typeof propDef.duration === 'number' ? propDef.duration : duration,
                        propVal = typeof propDef === 'object' ? propDef.val: propDef;
                
                    if (!propPre)
                        return; // can't do anything, we've failed!
                     
                    // update the max duration if necessary
                    if (propDur > maxDuration)
                        maxDuration = propDur;
                    // append this prop to the transition string
                    if (transStr)
                        transStr += ', ';
                    transStr += propPre + ' ' + (propDef.timing || conf.timing || 'linear') + ' ' + propDur + 'ms';
                    // set the target styles for the element for this prop
                    if (el.style[propPre] !== '') // if there is a style already set set the new style immediately
                        el.style[propPre] = propVal;
                    else { // otherwise set the style to the computed value and set the target style later
                        el.style[propPre] = getStyle(el, propPre);
                        setTimeout(function() {
                            el.style[propPre] = propVal;
                        }, 0);
                    }
                }
                if (propDef.delay)
                    delayTimeouts[prop] = setTimeout(afterDelay, propDef.delay);
                else
                    afterDelay();
            });
            el.style[css3TranitionProp] = transStr;
            // set a timeout for when the animation fully completes
            timeout = setTimeout(function() {
                timeout = null;
                stoppedOrComplete = true;
                // clear the transition styles for each
                el.style[css3TranitionProp] = '';
                // call the callback if any
                prom.complete();
            }, maxDuration);
            
            return {
                stop: function(finish) {
                    if (!stoppedOrComplete) {
                        stoppedOrComplete = true;
                        // clear any timeouts
                        for (var prop in conf.props)
                            if (delayTimeouts[prop])
                                clearTimeout(delayTimeouts[prop]);
                        if (timeout)
                            clearTimeout(timeout);
                        if (!finish) // if we don't want to finish, set the values to the current value
                            for (var prop in conf.props) {
                                var propPre = getPrefixedCssProp(prop);
                                if (propPre)
                                    el.style[propPre] = getStyle(el, propPre);
                            }
                        // clear the transition prop
                        el.style[css3TranitionProp] = '';
                        prom.complete();
                    }
                },
                onComplete: function(fn, scope) {
                    prom.onComplete(fn, scope);
                }
            };
        };
    } else { // can't use css3 transitons, fallback...

        var nativeRequestAnimationFrame = window.requestAnimationFrame
                || window.mozRequestAnimationFrame
                || window.webkitRequestAnimationFrame
                || window.msRequestAnimationFrame,
                nativeCancelAnimationFrame = window.cancelAnimationFrame
                || window.mozCancelAnimationFrame
                || window.webkitCancelAnimationFrame
                || window.msCancelAnimationFrame,
                timeoutAnimationFrameTime = 1000 / 60;
        
        /**
         * Calls the animation frame
         * @param {function} fn the function to execute
         * @returns {?} timeout or animation frame id
         */
        function requestAnimationFrame(fn) {
            if (nativeRequestAnimationFrame)
                return nativeRequestAnimationFrame(fn);
            else
                return setTimeout(fn, timeoutAnimationFrameTime);
        }

        /**
         * Cancels the requested animation frame
         * @param {?} id
         * @returns {undefined}
         */
        function cancelAnimationFrame(id) {
            if (id) {
                if (nativeRequestAnimationFrame)
                    nativeCancelAnimationFrame(id);
                else
                    clearTimeout(id);
            }
        }
        
        var timingFns = {
            'linear': function (t) { return t; },
            'ease-in': function (t) { return t*t; },
            'ease-out': function (t) { return t*(2-t); },
            'ease-in-out': function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t; }
          }, styleRegex = /^(\d+(.\d+)?)(px|em|%|pt|ex)?$/i;
        
        /**
         * Parses the given style string into a numeric value and suffix
         * @param {type} style the style string to parse
         * @returns {object} { val: numeric, suffix: string }
         */
        function parseNumericStyle(style) {
            var match = styleRegex.exec(''+style);
            if (!match) return false;
            return {
                val: parseFloat(match[1]),
                suffix: match[3] ? match[3].toLowerCase() : ''
            };
        }
        
        // frame based implementation
        window.simpleAnimate = function(conf) {
            var el = conf.el, animateFns = [], completedAnims = [], frameID, delayTimeouts = {},
                duration = typeof conf.duration === 'undefined' ? 1000 : conf.duration,
                stoppedOrComplete = false, prom = new promise();
            
            if (typeof el === 'string')
                el = document.querySelector(el);
            
            if (typeof conf.complete === 'function')
                prom.onComplete(conf.complete, conf.scope);
            
            eachObj(conf.props, function(propDef, prop) {
                function afterDelay() {
                    if (delayTimeouts[prop])
                        delete delayTimeouts[prop];
                    var propPre = getPrefixedCssProp(prop),
                            propDur = typeof propDef.duration === 'number' ? propDef.duration : duration,
                            propVal = typeof propDef === 'object' ? propDef.val: propDef,
                        startVal, endVal = parseNumericStyle(propVal), timingFn = timingFns[propDef.timing || conf.timing] || timingFns.linear,
                        startTime = new Date().getTime(), i = 0, s;
                
                    if (!propPre || !endVal)
                        return; // can't do anything, we've failed
                        
                    s = startVal = parseNumericStyle(getStyle(el, propPre));
                    
                    if (!s)
                        return; // can't do anything, we've failed!
                    
                    if (s.suffix !== endVal.suffix)
                        throw ('Unmatched style suffixes! Target styles should probably be in pixels.');
                    completedAnims.push(false);
                    animateFns.push(function(now, stop, finish) {
                        if (stop) {
                            if (finish)
                                el.style[propPre] = endVal.val + endVal.suffix;
                        } else {
                            var t = Math.min((now - startTime)/propDur, 1);
                            el.style[propPre] = (endVal.val - startVal.val) * timingFn(t) + startVal.val + endVal.suffix;
                            if (t === 1)
                                return false; // signal done
                        }
                    });
                }
                if (propDef.delay)
                    delayTimeouts[prop] = setTimeout(afterDelay, propDef.delay);
                else
                    afterDelay();
            });
            
            function doAnimate() {
                var now = new Date().getTime();
                frameID = null;
                var finished = true;
                for (var i=0; i<animateFns.length; ++i) {
                    if (!completedAnims[i]) {
                        if (animateFns[i](now, false) === false)
                            completedAnims[i] = true;
                        else
                            finished = false;
                    }
                }
                if (!finished)
                    frameID = requestAnimationFrame(doAnimate);
                else if (!stoppedOrComplete) {
                    stoppedOrComplete = true;
                    prom.complete();
                }
            }
            frameID = requestAnimationFrame(doAnimate);
            
            return {
                stop: function(finish) {
                    if (!stoppedOrComplete) {
                        stoppedOrComplete = true;
                        for (var prop in conf.props)
                            if (delayTimeouts[prop])
                                clearTimeout(delayTimeouts[prop]);
                        if (frameID)
                            cancelAnimationFrame(frameID);
                        for (var i=0; i<animateFns.length; ++i) {
                            if (!completedAnims[i])
                                animateFns[i](null, true, finish);
                        }
                        prom.complete();
                    }
                },
                onComplete: function(fn, scope) {
                    prom.onComplete(fn, scope);
                }
            };
        };
    }

})();/*
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


})(window);(function(routing, util) {

routing.on('ready', function() {
    
    // block backspace back navigation
    util.onEvent(document.body, 'keydown', function(event) {
        if (event.keyCode === 8) {
            var d = event.srcElement || event.target, tn = d.tagName.toLowerCase(), tt;
            ((tn === 'input' && ((tt = d.type.toLowerCase()) === 'text' || tt === 'password' || tt === 'file' || tt === 'email' ))
                    || tn === 'textarea' || d.hasAttribute('contenteditable') ? d.readOnly || d.disabled : true) && event.preventDefault();
        }
    });

    // do google anaylitics stuff, but defer it one second
    if ((document.location.search || '').indexOf('noanalytics') === -1)
        setTimeout(function() {
            (function(i, s, o, g, r, a, m) {
                i['GoogleAnalyticsObject'] = r;
                i[r] = i[r] || function() {
                    (i[r].q = i[r].q || []).push(arguments)
                }, i[r].l = 1 * new Date();
                a = s.createElement(o),
                        m = s.getElementsByTagName(o)[0];
                a.async = 1;
                a.src = g;
                m.parentNode.insertBefore(a, m)
            })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');
            ga('create', 'UA-50246126-1', 'aaroncake.io');
            ga('send', 'pageview');
        }, 1000);

    // show/collapse the nav when .nav-collapse is clicked
    var collapse = util.domQuery('.nav-collapse');
    util.onEvent('.nav-btn', 'click', function() {
        var hc = util.hasClass(collapse, 'collapse');
        collapse._currentAnim && collapse._currentAnim.stop();
        collapse._currentAnim = simpleAnimate({
            el: collapse,
            props: {
                opacity: hc ? 1 : 0
            },
            timing: 'ease-out',
            duration: 300,
            complete: function() {
                hc || util.addClass(collapse, 'collapse');
                collapse.setAttribute('style', '');
            }
        });
        hc && util.removeClass(collapse, 'collapse');
    });

    // collapse the nav when a link is clicked
    util.onEvent('.nav-link, .nav-link-menu > a', 'click', function() {
        if (!util.hasClass(collapse, 'collapse'))
            util.fireEvent('.nav-btn', 'click');
    });

});

// include html or text when data-include or data-include-text attrubutes are defined
routing.addDomProcessor(function(dom, cb) {
    var a = new asynclist();
    util.eachArr(util.domQueryAll('[data-include],[data-include-text]'), function(el) {
        var url = el.getAttribute('data-include'), textUrl = el.getAttribute('data-include-text');
        if (url || textUrl) {
            a.add(routing.ajax(url || textUrl, function(r) {
                if (r.success)
                    if (url)
                        el.innerHTML = r.text;
                    else
                        el.appendChild(document.createTextNode(r.text));
            }));
        }
    });
    a.end().onComplete(cb);
});

// highlight all code elements
routing.on('contentLoaded', function(el, url){
    util.eachArr(el.querySelectorAll('pre > code[class*=language-]'), highlightElement);
});

// update which nav links are active when the path changes
routing.on('pathChange', function(hash) {
    var path = hash.path;
    if (path.length > 0 && path[path.length-1] === '')
        path.splice(path.length-1, 1);
    util.eachArr(util.domQueryAll('a.nav-link[href], .nav-link-menu > a[href]'), function(el) {
        var href = el.getAttribute('href').replace(/(^#\/)|(\/$)/g, ''),
            arr = href.split('/');
        if (href === '') {
            (path.length === 0 ? util.addClass : util.removeClass)(el, 'nav-link-active');
        } else if (arr.length <= hash.path.length) {
            for (var i=0; i<arr.length; ++i) {
                if (arr[i] !== hash.path[i]) {
                    util.removeClass(el, 'nav-link-active');
                    return;
                }
            }
            util.addClass(el, 'nav-link-active');
        } else {
            util.removeClass(el, 'nav-link-active');
        }
    });
});

var highlightText = (function() {
    var cache = new Cache({ maxWeight: 1000000 }), worker, nextID = 0;
    return function(text, lang, async, cb, scope) {
        routing.requireCSS('css/prism.css');
        var cacheKey = lang + ':' + text,
            highlighted = cache.get(cacheKey), ret;
        if (highlighted) {
            ret = { success: true, html: highlighted };
            cb && cb.call(scope, ret);
            return ret;
        } else {
            if (async && window.Worker) {
                if (!worker) {
                    worker = new Worker('js/prism-worker.js');
                    worker.addEventListener('error', function(e) {
                        console.log('error!', e);
                    });
                }
                var msgID = nextID++;
                worker.postMessage({ id: msgID, text: text, lang: lang });
                function onMessage(msg) {
                    var data = msg.data;
                    if (data.id === msgID) {
                        worker.removeEventListener('message', onMessage);
                        if (data.success) {
                            cache.put(cacheKey, data.html, data.html.length);
                            cb && cb.call(scope, { success: true, html: data.html });
                        } else {
                            cb && cb.call(scope, { success: false, error: data.error });
                        }
                    }
                }
                worker.addEventListener('message', onMessage);
            } else {
                routing.requireScript('js/prism.js', true);
                var langDef = Prism.languages[lang];
                if (!langDef) {
                    ret = { success: false, html: 'Language ' + lang + ' not defined.' };
                    cb && cb.call(scope, ret);
                    return ret;
                } else {
                    highlighted = Prism.highlight(text, langDef);
                    cache.put(cacheKey, highlighted, highlighted.length);
                    ret = { success: true, html: highlighted };
                    cb && cb.call(scope, ret);
                    return ret;
                }
            }
        }
    };
})();

function highlightElement(el) {
    var match = /\blanguage-(\w+)\b/.exec(el.className);
    console.log(el, el.className);
    if (match) {
        highlightText(el.innerHTML, match[1], true, function(result) {
           if (result.success) {
               el.innerHTML = result.html;
           } else {
               console.log(result.error);
           }
        });
    }
}

routing.init({
    logCSSLoad: false,
    logJSLoad: false,
    logContentLoad: false,
    logOutcomeMatch: false,
    defaultTransition: 'fade',
    defaultInitialPath: '/',
    //redirectInvalid: null,
    defaultOtherwise: 'partials/notfound.html',
    defaultTransitionDuration: 300,
    //validPaths: [/.*/],
    outcomes: {
        '#content-container': {
            '^/$': 'partials/home.html',
            '^/(home|projects|contact)/?$': 'partials/${0}.html',
            '^/resume/?$': {
                url: 'partials/resume.html',
                css: 'css/resume.css'//,
                        //js: 'js/class.js'
            },
            '^/projects/(context-free-grammar)/?$':  'partials/projects/${1}.html',
            '^/projects/php-fiddle/?$': {
                url: 'partials/projects/php-fiddle.html',
                js: 'js/php-fiddle.js',
                css: ['css/php-fiddle.css', 'css/prism.css']
            },
            otherwise: 'partials/notfound.html',
            transition: function(current, next, prevHash, curHash) {
                if (!current || !next)
                    return {fade: 600};
                else
                    return {fade: 300};
                /*if (!current || !next) return { fade: 1000 };
                 var navLinks = {
                 'partials/home.html': 1,
                 'partials/resume.html': 2,
                 'partials/projects.html': 3,
                 'partials/contact.html': 4,
                 }, a = navLinks[current], b = navLinks[next],
                 o = {}, t = a && b ? a > b ? 'slideRight' : 'slideLeft' : current < next ? 'slideRight' : 'slideLeft';
                 o[t] = t == 'fade' ? 1000 : 600;
                 return o;*/
            }
        }
    }
});

})(routing, util);