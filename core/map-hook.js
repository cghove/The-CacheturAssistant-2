// [core/map-hook.js]
(function(){
  'use strict';
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var TCA2 = root.TCA2 = root.TCA2 || {};
  var log = (TCA2.log || console);
  log.info('[core/map-hook.js] Loaded');

  function leafletPresent(){
    return !!(root.L && root.L.map);
  }

  if (leafletPresent()) {
    log.info('[core/map-hook.js] Ready');
    log.info('[core/map-hook.js] Leaflet detected');
  } else {
    log.info('[core/map-hook.js] Ready');
  }
})();