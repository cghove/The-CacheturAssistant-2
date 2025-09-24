// [TCA2] core/env.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  // Minimal event bus
  class Bus {
    constructor(){ this._ev = document.createElement('div'); }
    on(type, h){ this._ev.addEventListener(type, h, true); }
    off(type, h){ this._ev.removeEventListener(type, h, true); }
    emit(type, detail){ this._ev.dispatchEvent(new CustomEvent(type, {detail})); }
  }
  TCA2.bus = TCA2.bus || new Bus();

  // Prefixed logger helpers
  ["info","warn","error","debug","log"].forEach(fn => {
    if (!log[fn]) return;
    const orig = log[fn].bind(log);
    TCA2.log[fn] = (...args) => orig("[TCA2]", ...args);
  });

  TCA2.log.info("[core/env.js] Loaded");
  TCA2.log.info("[core/env.js] Ready");
})();
