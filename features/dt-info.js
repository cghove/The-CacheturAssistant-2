/* features/dt-info.js */
(function() {
  const log = (...a) => console.log("[TCA2] [features/dt-info.js]", ...a);
  const $ = window.jQuery || window.$;
  if (!/geocaching\.com/.test(location.host)) { log("Skipped (host)"); return; }

  $(function(){
    log("Ready");
    // Placeholder for Difficulty/Terrain enhancements
  });
})();