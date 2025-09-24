// [core/env.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log = TCA2.log || console;

  // Simple event bus
  const handlers = {};
  TCA2.bus = TCA2.bus || {
    on: function(evt, fn){ (handlers[evt] = handlers[evt] || []).push(fn); },
    off: function(evt, fn){ if(!handlers[evt]) return; const i = handlers[evt].indexOf(fn); if(i>=0) handlers[evt].splice(i,1); },
    emit: function(evt, data){ (handlers[evt]||[]).forEach(fn => { try{ fn(data);}catch(e){ log.warn('[TCA2] bus handler error', e);} }); }
  };

  log.info('[TCA2] [core/env.js] Loaded');
  log.info('[TCA2] [core/env.js] Ready');
})();