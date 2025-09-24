// [TCA2] features/dt-info.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);
  log.info('[features/dt-info.js] Loaded');

  function ready() {
    log.info('[features/dt-info.js] Ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
