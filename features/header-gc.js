// [TCA2] features/header-gc.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);
  log.info('[features/header-gc.js] Loaded');

  function buildHeader() {
    const $ = root.jQuery || root.$;
    if (!$) return;

    const userMenu = document.querySelector('#gc-header-root ul.user-menu');
    if (!userMenu) return;

    if (document.getElementById('cachetur-header')) return; // avoid duplicate

    const li = document.createElement('li');
    li.id = 'cachetur-header';
    li.className = 'ct-gc-classic';
    li.innerHTML = ''
      + '<span id="cachetur-header-text">'
      + '  <img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no"> '
      + '  <a href="" id="cachetur-activate">Activate the Cachetur Assistant</a>'
      + '</span>';

    // Insert before message center if possible, else at start
    const messageCenter = userMenu.querySelector('.message-center')?.closest('li');
    if (messageCenter) {
      userMenu.insertBefore(li, messageCenter);
    } else {
      userMenu.insertBefore(li, userMenu.firstChild);
    }

    $('#cachetur-activate').on('click', function(e) {
      e.preventDefault();
      if (TCA2.bus && TCA2.bus.emit) {
        TCA2.bus.emit('tca2:activate');
      }
    });

    log.info('[features/header-gc.js] Ready');
  }

  function maybeBuild() {
    const isGC = /(^|\.)geocaching\.com$/i.test(location.host);
    if (!isGC) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildHeader);
    } else {
      buildHeader();
    }
  }

  maybeBuild();
})();
