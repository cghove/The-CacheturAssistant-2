// [TCA2] core/page-detect.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);

  function detect() {
    const href = location.href;
    const host = location.host;

    const isGC = /(^|\.)geocaching\.com$/i.test(host);
    const isPGC = /(^|\.)project-gc\.com$/i.test(host);
    const isCachetur = /(^|\.)cachetur\.(no|net)$/i.test(host);

    const isGCMap = isGC && /(\/map(\/|#|\?|$)|\/play\/map)/i.test(href);
    const isGCListing = isGC && /(\/geocache\/|\/seek\/cache_details\.aspx)/i.test(href);

    return {
      isGC,
      isGCMap,
      isGCListing,
      isPGC,
      isCachetur,
      href
    };
  }

  TCA2.page = detect();
  (TCA2.log || console).info('[core/page-detect.js] Loaded');

  const ready = () => (TCA2.log || console).info('[core/page-detect.js] Ready');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
