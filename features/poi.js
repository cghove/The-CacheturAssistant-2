/* features/poi.js */
(function() {
  const log = (...a) => console.log("[TCA2] [features/poi.js]", ...a);
  const $ = window.jQuery || window.$;
  const page = (window.TCA2 && window.TCA2.page) || {};
  if (!page.isGCMap) { log("Skipped (not map)"); return; }

  $(function(){
    log("Ready");
    // Placeholder for POI layer handling
  });
})();