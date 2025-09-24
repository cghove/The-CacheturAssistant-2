// [TCA2] core/page-detect.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const href = location.href;

  const isGCMap      = /geocaching\.com\/(map|play\/map)/i.test(href);
  const isGCListing  = /geocaching\.com\/(geocache|seek\/cache_details\.aspx)/i.test(href);
  const isPGC        = /project-gc\.com/i.test(href);
  const isCachetur   = /cachetur\.(no|net)/i.test(href);

  TCA2.page = Object.assign({}, TCA2.page || {}, { href, isGCMap, isGCListing, isPGC, isCachetur });
  TCA2.log.info("[core/page-detect.js] Loaded");
  TCA2.log.info("[core/page-detect.js] Ready");
})();
