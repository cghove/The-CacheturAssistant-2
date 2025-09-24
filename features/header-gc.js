// [TCA2] features/header-gc.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const $ = root.$ || root.jQuery;

  function injectHeader(){
    // Only on geocaching.com
    if (!/geocaching\.com/i.test(location.hostname)) return;

    const menu = document.querySelector("ul.user-menu");
    if (!menu) return;

    if (document.getElementById("cachetur-header")) return; // already there

    const li = document.createElement("li");
    li.id = "cachetur-header";
    li.className = "ct-gc-classic";
    li.innerHTML = '<span id="cachetur-header-text"><img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" style="height:24px;vertical-align:middle;margin-right:6px;"> <a href="#" id="cachetur-activate">Activate the Cachetur Assistant</a></span>';
    menu.insertBefore(li, menu.firstChild);

    const activate = li.querySelector("#cachetur-activate");
    activate.addEventListener("click", function(ev){
      ev.preventDefault();
      if (TCA2.bus){ TCA2.bus.emit("tca2:activate"); }
    }, true);
  }

  // Try immediately and also when DOM is interactive
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", injectHeader, { once: true, capture: true });
  } else {
    injectHeader();
  }

  TCA2.log.info("[features/header-gc.js] Ready");
})();
