// [features/header-gc.js]
(function(){
  'use strict';
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var TCA2 = root.TCA2 = root.TCA2 || {};
  var log = (TCA2.log || console);
  var $ = TCA2.$ || root.jQuery || root.$ || null;

  function insertHeader(){
    try {
      // Find GC header user menu (desktop)
      var userMenu = root.document.querySelector('ul.user-menu');
      if (!userMenu) return false;
      if (root.document.getElementById('cachetur-header')) return true;

      var li = root.document.createElement('li');
      li.id = 'cachetur-header';
      li.className = 'ct-gc-classic';
      li.innerHTML = '<span id="cachetur-header-text">' +
        '<img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" style="vertical-align:middle;height:20px;margin-right:6px;"> ' +
        '<a href="#" id="cachetur-activate">Activate the Cachetur Assistant</a>' +
        '</span>';
      // Insert as first li in user menu
      userMenu.insertBefore(li, userMenu.firstChild);

      // Click handler -> bus emit
      var a = li.querySelector('#cachetur-activate');
      if (a) {
        a.addEventListener('click', function(e){
          e.preventDefault();
          if (TCA2.bus && TCA2.bus.emit) TCA2.bus.emit('tca2:activate');
        }, { capture: true });
      }
      return true;
    } catch(e){
      log.warn('[features/header-gc.js] insertHeader error', e);
      return false;
    }
  }

  function waitForHeader(){
    if (insertHeader()) {
      log.info('[features/header-gc.js] Ready');
      return;
    }
    var mo = new MutationObserver(function(muts){
      if (insertHeader()) {
        log.info('[features/header-gc.js] Ready');
        try { mo.disconnect(); } catch(e){}
      }
    });
    mo.observe(root.document.documentElement || root.document.body, { childList: true, subtree: true });
  }

  waitForHeader();
})();