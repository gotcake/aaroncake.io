/*
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

})();