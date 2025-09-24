// [TCA2] app/ct-start.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);

  function initBus() {
    // Example activation handler
    if (TCA2.bus && TCA2.bus.on) {
      TCA2.bus.on('tca2:activate', function() {
        log.info('[app/ct-start.js] Activation requested');
        // Hook future activation logic here
      });
    }
    log.info('[app/ct-start.js] Bus ready');
  }

  initBus();
  log.info('[app/ct-start.js] Loaded');
})();
