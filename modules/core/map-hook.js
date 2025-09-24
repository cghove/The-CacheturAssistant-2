// [core/map-hook.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  log.info('[TCA2] [core/map-hook.js] Loaded');
  log.info('[TCA2] [core/map-hook.js] Ready');
  if (root.L) log.info('[TCA2] [core/map-hook.js] Leaflet detected');
})();