// [TCA2] core/map-hook.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};

  TCA2.log.info("[core/map-hook.js] Loaded");
  if (root.L && root.L.map){
    TCA2.log.info("[core/map-hook.js] Leaflet detected");
  }
  TCA2.log.info("[core/map-hook.js] Ready");
})();
