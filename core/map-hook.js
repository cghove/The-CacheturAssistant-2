// [TCA2] core/map-hook.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);
  log.info('[core/map-hook.js] Loaded');

  function ready() {
    if (root.L && root.L.Map) {
      log.info('[core/map-hook.js] Ready');
      log.info('[core/map-hook.js] Leaflet detected');
    } else {
      log.info('[core/map-hook.js] Ready');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
