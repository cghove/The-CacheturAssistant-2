// [app/ct-start.js]
(function(){
  'use strict';
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var TCA2 = root.TCA2 = root.TCA2 || {};
  var log = (TCA2.log || console);
  var $ = TCA2.$ || root.jQuery || root.$ || null;

  var _initialized = false;
  var _ctCacheturUser = '';
  var _ctLanguage = 'en';

  function ctStart(){
    // When user clicks "Activate the Cachetur Assistant"
    let lastUse = (typeof GM_getValue === 'function') ? GM_getValue("cachetur_last_action", 0) : 0;
    let timeSinceLastUse = (Date.now() - lastUse) / 1000;
    log.info("The Cachetur Assistant was last used " + timeSinceLastUse + " seconds ago");

    if (timeSinceLastUse > 3600) {
      ctInitInactive();
    } else {
      ctPreInit();
    }
  }

  function ctPreInit(){
    log.info("Continuing init of Cachetur Assistant");
    // We no longer depend on DOMSubtreeModified; just proceed to login check.
    ctCheckLogin();
  }

  function ctCheckLogin(){
    log.info("Checking login");
    if (!TCA2.auth || !TCA2.auth.checkLogin) {
      log.warn("Auth module missing; continuing without login");
      _ctCacheturUser = '';
      _ctLanguage = 'en';
      ctInitNotLoggedIn();
      return;
    }
    TCA2.auth.checkLogin().then(function(user){
      _ctCacheturUser = user.username || '';
      _ctLanguage = user.language || 'en';
      if (TCA2.i18n && TCA2.i18n.changeLanguage) {
        TCA2.i18n.changeLanguage(_ctLanguage);
      }
      log.info("Cachetur language set to:", _ctLanguage);

      if (!_ctCacheturUser) {
        log.info("Not logged in");
        _initialized = false;
        ctInitNotLoggedIn();
      } else {
        log.info("Login OK");
        _initialized = false;
        ctInit(true);
      }
    });
  }

  function ctInvalidateLogin(){
    _ctCacheturUser = '';
    var el = root.document.getElementById('cachetur-header');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function ctInitInactive(){
    log.info("Init inactive state");
    ctPreInit(); // keep it simple for now
  }

  function ctInitNotLoggedIn(){
    log.info("Init not-logged-in state");
    // Could show a tooltip or open Cachetur login page
  }

  function ctInit(active){
    _initialized = true;
    // Mark as used now
    if (typeof GM_setValue === 'function') GM_setValue("cachetur_last_action", Date.now());
    // Update header CTA text
    var a = root.document.getElementById('cachetur-activate');
    if (a) {
      a.textContent = 'Cachetur Assistant active';
      a.removeAttribute('href');
      a.style.pointerEvents = 'none';
      a.style.opacity = '0.85';
    }
    log.info("Cachetur Assistant initialized", { active: !!active, user: _ctCacheturUser });
  }

  // Listen to activation event from header module
  if (TCA2.bus && TCA2.bus.on) {
    TCA2.bus.on('tca2:activate', function(){
      log.info('[app/ct-start.js] Activation requested');
      ctStart();
    });
  }

  log.info('[app/ct-start.js] Bus ready');
  log.info('[app/ct-start.js] Loaded');
})();