/* features/misc.js */
(function() {
  const log = (...a) => console.log("[TCA2] [features/misc.js]", ...a);
  const $ = window.jQuery || window.$;

  // Ensure legacy modules can expect window.jQuery
  if (typeof window.jQuery === "undefined" && typeof window.$ !== "undefined") {
    window.jQuery = window.$;
  }

  $(function(){
    log("Ready");
    // Misc small helpers can live here
  });
})();