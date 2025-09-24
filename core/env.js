// [core/env.js]
(function(){
  'use strict';
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var TCA2 = root.TCA2 = root.TCA2 || {};

  // Logger (ensure exists for all modules)
  var c = root.console || {};
  function wrap(fn){ return function(){ try { fn.apply(c, ["[core/env.js]"].concat([].slice.call(arguments))); } catch(e){} }; }
  var logger = {
    log: wrap(c.log || function(){}),
    info: wrap(c.info || c.log || function(){}),
    warn: wrap(c.warn || c.log || function(){}),
    error: wrap(c.error || c.log || function(){})
  };
  // Expose on TCA2
  TCA2.log = TCA2.log || logger;
  TCA2.VERSION = '0.2.2';

  // jQuery alias
  TCA2.$ = root.jQuery || root.$ || null;

  // Simple event bus
  var listeners = {};
  TCA2.bus = TCA2.bus || {
    on: function(evt, fn){
      (listeners[evt] = listeners[evt] || []).push(fn);
    },
    off: function(evt, fn){
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter(f=>f!==fn);
    },
    emit: function(evt, payload){
      (listeners[evt]||[]).forEach(f=>{ try { f(payload); } catch(e){ logger.error('[bus]', evt, e); } });
    }
  };

  // GM helpers
  TCA2.gm = TCA2.gm || {
    get: function(k, d){ try { return GM_getValue(k, d); } catch(e){ return d; } },
    set: function(k, v){ try { return GM_setValue(k, v); } catch(e){} },
    style: function(css){ try { GM_addStyle(css); } catch(e){} },
    xhr: function(opts){
      return new Promise(function(resolve, reject){
        try {
          GM_xmlhttpRequest(Object.assign({
            method: 'GET',
            onload: function(res){ resolve(res); },
            onerror: function(err){ reject(err); }
          }, opts));
        } catch(e){ reject(e); }
      });
    }
  };

  TCA2.log.info('[core/env.js] Loaded');
  TCA2.log.info('[core/env.js] Ready');
})();