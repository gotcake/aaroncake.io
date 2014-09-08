/**
 * This is a
 * multi-line comment
 */
importScripts('prism.js');

addEventListener('message', function(msg){
    try {
        var lang =  Prism.languages[msg.data.lang];
        if (lang) {
            postMessage({ success: true, html: Prism.highlight(msg.data.text, lang), id: msg.data.id });
        } else {
             postMessage({ success: false, id: msg.data.id, error: 'Language ' + msg.data.lang + ' not defined.'});
        }
    } catch(e) {
        postMessage({ success: false, id: msg.data.id, error: 'Error caught: ' + e.message});
    }
});
