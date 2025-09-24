// [TCA2] core/map-hook.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;
  log.info('[core/map-hook.js] Loaded');

  function hasLeaflet(){
    return !!(root.L && root.L.map);
  }

  function ready(){
    log.info('[core/map-hook.js] Ready');
    if (hasLeaflet()) log.info('[core/map-hook.js] Leaflet detected');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    ready();
  } else {
    document.addEventListener('DOMContentLoaded', ready);
  }
})();