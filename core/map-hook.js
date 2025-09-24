/* core/map-hook.js */
(function() {
  const log = (...a) => console.log("[TCA2] [core/map-hook.js]", ...a);
  const $ = window.jQuery || window.$;
  const page = (window.TCA2 && window.TCA2.page) || {};

  if (!page.isGCMap) { log("Skipped (not on GC map)"); return; }

  function ready() {
    log("Ready");
    // Placeholder: hook into Leaflet if present
    const L = window.L;
    if (L && typeof L.map === "function") {
      log("Leaflet detected");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();