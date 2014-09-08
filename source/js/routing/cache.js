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

})();