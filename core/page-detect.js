// [core/page-detect.js]
(function(){
  'use strict';
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var TCA2 = root.TCA2 = root.TCA2 || {};
  var log = (TCA2.log || console);
  log.info('[core/page-detect.js] Loaded');
  var host = location.host;
  var path = location.pathname;
  var isGC = /geocaching\.com/i.test(host);
  var isPGC = /project-gc\.com/i.test(host);
  var isCachetur = /cachetur\.(no|net)/i.test(host);
  var isGCMap = isGC && /\/(map|play\/map)/i.test(path);
  var isGCListing = isGC && (/\/geocache\//i.test(path) || /\/seek\/cache_details\.aspx/i.test(path));
  TCA2.page = { isGC, isPGC, isCachetur, isGCMap, isGCListing, href: location.href };

  // Legacy _ctPage flag used by old modules
  var _ctPage = 'other';
  if (isGCMap) _ctPage = 'gc_map';
  else if (isGCListing) _ctPage = 'gc_geocache';
  else if (isPGC && /\/map\//i.test(path)) _ctPage = 'pgc_map';
  root._ctPage = _ctPage;
  log.info('[core/page-detect.js] Ready');
})();