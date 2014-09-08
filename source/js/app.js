(function(routing, util) {

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