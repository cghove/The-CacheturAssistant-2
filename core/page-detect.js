/* core/page-detect.js */
(function() {
  const log = (...a) => console.log("[TCA2] [core/page-detect.js]", ...a);
  const $ = window.jQuery || window.$;
  const href = location.href;

  const isGCMap     = /geocaching\.com\/(map|play\/map|live\/play\/map)/i.test(href);
  const isGCListing = /geocaching\.com\/(geocache|seek\/cache_details\.aspx)/i.test(href);
  const isPGC       = /project-gc\.com/i.test(href);
  const isCachetur  = /cachetur\.(no|net)/i.test(href);

  window.TCA2 = window.TCA2 || {};
  window.TCA2.page = { href, isGCMap, isGCListing, isPGC, isCachetur };

  log("Loaded");
  $(function(){ log("Ready"); });
})();