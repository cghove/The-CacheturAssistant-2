// [TCA2] core/env.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;
  log.info('[core/env.js] Loaded');

  // Simple event bus
  const bus = (function() {
    const handlers = {};
    return {
      on(evt, fn){ (handlers[evt] = handlers[evt] || []).push(fn); },
      off(evt, fn){
        if (!handlers[evt]) return;
        const i = handlers[evt].indexOf(fn);
        if (i >= 0) handlers[evt].splice(i,1);
      },
      emit(evt, data){
        (handlers[evt] || []).forEach(fn => {
          try { fn(data); } catch(e){ log.error('[bus]', evt, e); }
        });
      }
    };
  })();

  TCA2.bus = TCA2.bus || bus;

  // GM_* helpers (guarded for environments with different grants)
  TCA2.gm = TCA2.gm || {
    getValue: (k, d)=> (typeof GM_getValue === 'function' ? GM_getValue(k, d) : d),
    setValue: (k, v)=> (typeof GM_setValue === 'function' ? GM_setValue(k, v) : undefined),
    xhr: (opts)=> (typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest(opts) : null),
    addStyle: (css)=> (typeof GM_addStyle === 'function' ? GM_addStyle(css) : (function(){
      const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    })())
  };

  // jQuery expose
  try { root.$ = root.jQuery = root.jQuery || jQuery || $; } catch(e) {}

  log.info('[core/env.js] Ready');
})();