// [core/page-detect.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  const href = location.href;
  const page = {
    isGCMap: /geocaching\.com\/(play\/)?map/.test(href),
    isGCListing: /geocaching\.com\/(geocache|seek\/cache_details)/.test(href),
    isPGC: /project-gc\.com/.test(href),
    isCachetur: /cachetur\.no/.test(href),
    href
  };
  TCA2.page = Object.assign({}, TCA2.page || {}, page);

  log.info('[TCA2] [core/page-detect.js] Loaded');
  log.info('[TCA2] [core/page-detect.js] Ready');
})();