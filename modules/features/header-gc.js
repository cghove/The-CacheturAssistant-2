// [features/header-gc.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  function injectHeader(){
    const headerRoot = document.getElementById('gc-header-root');
    if (!headerRoot) return false;

    // Find the right-side user menu UL
    const container = headerRoot.querySelector('ul.user-menu');
    if (!container) return false;

    // Avoid duplicates
    const existing = container.querySelector('#cachetur-header');
    if (existing) existing.remove();

    const li = document.createElement('li');
    li.id = 'cachetur-header';
    li.className = 'ct-gc-classic';
    const span = document.createElement('span');
    span.id = 'cachetur-header-text';
    span.innerHTML = '<img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no"> <a href="#" id="cachetur-activate">Activate the Cachetur Assistant</a>';
    li.appendChild(span);

    // Insert as first item in user-menu
    container.insertBefore(li, container.firstChild);

    // Click handler
    const a = li.querySelector('#cachetur-activate');
    if (a) {
      a.addEventListener('click', function(ev){
        ev.preventDefault();
        if (TCA2.bus && TCA2.bus.emit) TCA2.bus.emit('tca2:activate');
      }, { capture: true });
    }

    return true;
  }

  function ready(){
    // Try immediately, then observe header changes (React updates)
    if (!injectHeader()) {
      const observer = new MutationObserver(() => {
        if (injectHeader()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if ((TCA2.page && TCA2.page.isGCMap) || /geocaching\.com/.test(location.host)) {
    ready();
  }

  log.info('[TCA2] [features/header-gc.js] Ready');
})();