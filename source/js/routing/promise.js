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
