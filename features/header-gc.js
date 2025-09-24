// [TCA2] features/header-gc.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  function insertHeader(){
    // Find the GC header user-menu UL
    const container = document.querySelector('ul.user-menu');
    if (!container) return false;

    if (document.getElementById('cachetur-header')) return true; // already inserted

    const li = document.createElement('li');
    li.id = 'cachetur-header';
    li.className = 'ct-gc-classic';
    const span = document.createElement('span');
    span.id = 'cachetur-header-text';

    const img = document.createElement('img');
    img.src = 'https://cachetur.net/img/logo_top.png';
    img.alt = 'cachetur.no';
    img.style.verticalAlign = 'middle';
    img.style.height = '20px';
    img.style.marginRight = '6px';

    const a = document.createElement('a');
    a.href = '#';
    a.id = 'cachetur-activate';
    a.textContent = 'Activate the Cachetur Assistant';
    a.style.color = 'white';
    a.style.textDecoration = 'underline';

    span.appendChild(img);
    span.appendChild(a);
    li.appendChild(span);

    // Insert as first item in user-menu
    container.insertBefore(li, container.firstChild);

    a.addEventListener('click', function(e){
      e.preventDefault();
      try {
        if (TCA2.bus && TCA2.bus.emit) TCA2.bus.emit('tca2:activate');
      } catch(err){ log.error(err); }
    });

    return true;
  }

  function ready(){
    insertHeader();
    log.info('[features/header-gc.js] Ready');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    ready();
  } else {
    document.addEventListener('DOMContentLoaded', ready);
  }
})();