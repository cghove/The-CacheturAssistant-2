/* app/ct-start.js */
(function() {
  const log = (...a) => console.log("[TCA2] [app/ct-start.js]", ...a);
  const $ = window.jQuery || window.$;
  const bus = (window.TCA2 && window.TCA2.bus) || $({});

  function mountBadge() {
    const el = $('<div id="tca2-badge" style="position:fixed;z-index:99999;bottom:12px;right:12px;padding:.4rem .6rem;border-radius:.5rem;background:#2d3748;color:#fff;font:12px/1.2 system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;box-shadow:0 4px 10px rgba(0,0,0,.2);">TCA2</div>');
    if (!document.getElementById("tca2-badge")) $('body').append(el);
  }

  $(mountBadge);
  bus.on("tca2:ready", () => log("Bus ready"));
  log("Loaded");
})();