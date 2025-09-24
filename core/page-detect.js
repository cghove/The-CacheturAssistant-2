// [TCA2] core/page-detect.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  function detect(){
    const href = location.href;
    const host = location.hostname;
    const isGC = /geocaching\.com$/i.test(host) || /(^|\.)geocaching\.com$/i.test(host);
    const isPGC = /project-gc\.com$/i.test(host);
    const isCachetur = /cachetur\.(no|net)$/i.test(host);
    const isGCMap = isGC && /\/(play\/map|map\/?#)/i.test(href);
    const isGCListing = isGC && /\/geocache\//i.test(href);
    return { href, host, isGC, isPGC, isCachetur, isGCMap, isGCListing, site: isGC ? 'gc' : (isPGC ? 'pgc' : (isCachetur ? 'cachetur' : 'other')) };
  }

  TCA2.page = detect();
  // Legacy alias
  root._ctPage = (TCA2.page.isGCMap ? 'gc_map_new'
                : TCA2.page.isGCListing ? 'gc_geocache'
                : TCA2.page.isPGC ? 'pgc'
                : TCA2.page.isCachetur ? 'cachetur'
                : 'other');

  TCA2.log.info('[core/page-detect.js] Loaded');
  TCA2.log.info('[core/page-detect.js] Ready');
})();