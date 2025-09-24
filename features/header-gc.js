/* features/header-gc.js */
(function() {
  const log = (...a) => console.log("[TCA2] [features/header-gc.js]", ...a);
  const $ = window.jQuery || window.$;
  if (!/geocaching\.com/.test(location.host)) { log("Skipped (host)"); return; }

  $(function(){
    log("Ready");
    // Example: add a small menu item
    try {
      const $header = $("#gc-header, header");
      if ($header.length) {
        const $link = $('<a href="https://cachetur.no" target="_blank" rel="noopener" style="margin-left:8px;">Cachetur</a>');
        $header.find("nav, .nav, .header, .navigation").first().append($link);
      }
    } catch(e) { console.warn("[TCA2] header-gc:", e); }
  });
})();