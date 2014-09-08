var isIElt9 = (function() {
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
