routing.defineTransition('fade', {
    
    out: function(el, duration, callback) {
        var me = this;
        me.outAnim = simpleAnimate({
           el: el,
           props: {
               opacity: 0
           },
           timing: 'ease-out',
           duration: duration,
           complete: function() {
               me.outAnim = null;
               while (el.firstChild) 
                   el.removeChild(el.firstChild);
               callback();
           }
        });
    },
    
    'in': function(el, content, duration, callback){
        var me = this;
        while (el.firstChild) // just to be safe
            el.removeChild(el.firstChild);
        el.appendChild(content);
        el.style.opacity = 0;
        me.inAnim = simpleAnimate({
           el: el,
           props: {
               opacity: 1
           },
           timing: 'ease-in',
           duration: duration,
           complete: function() {
               me.inAnim = null;
               callback();
           }
        });
    },
    
    cancel: function() {
        if (this.inAnim)
            this.inAnim.stop(false);
        if (this.outAnim)
            this.outAnim.stop(false);
    }
    
});


