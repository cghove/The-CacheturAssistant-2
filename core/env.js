/* core/env.js */
(function() {
  // Ensure jQuery is globally available
  if (typeof window.jQuery === "undefined" && typeof window.$ !== "undefined") {
    window.jQuery = window.$;
  } else if (typeof window.$ === "undefined" && typeof window.jQuery !== "undefined") {
    window.$ = window.jQuery;
  }

  const log = (...a) => console.log("[TCA2] [core/env.js]", ...a);
  const $ = window.jQuery || window.$;

  if (!window.TCA2) window.TCA2 = {};
  if (!window.TCA2.bus) window.TCA2.bus = $({});

  // Simple guard util
  window.TCA2.guard = function guard(name, fn) {
    try { return fn(); } catch(e) { console.warn(`[TCA2] [${name}]`, e); }
  };

  log("Loaded");
  $(function(){ log("Ready"); });
})();