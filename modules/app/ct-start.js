// [app/ct-start.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  function getCtPage() {
    const p = TCA2.page || {};
    if (p.isGCMap) return 'gc_map';
    if (p.isGCListing) return 'gc_geocache';
    if (p.isPGC) return 'pgc_map';
    if (p.isCachetur) return 'cachetur';
    return 'other';
  }

  function ctStart(){
    const lastUse = (typeof GM_getValue !== 'undefined') ? GM_getValue("cachetur_last_action", 0) : 0;
    const timeSinceLastUse = (Date.now() - lastUse) / 1000;
    log.info("[TCA2] The Cachetur Assistant was last used " + timeSinceLastUse + " seconds ago");

    if (timeSinceLastUse > 3600){
      ctInitInactive();
    } else {
      ctPreInit();
    }
  }

  function ctPreInit(){
    log.info("[TCA2] Continuing init of Cachetur Assistant");
    // In the classic code this waited for certain DOM states; simplified and robust path here:
    ctCheckLogin();
  }

  function ctCheckLogin(){
    log.info("[TCA2] Checking login");
    if (!TCA2.auth || !TCA2.auth.checkLogin) {
      // If API/auth is not ready, continue in "guest" mode
      root._ctCacheturUser = '';
      root._ctLanguage = 'en';
      if (root.i18next) root.i18next.changeLanguage(root._ctLanguage);
      log.info("[TCA2] Auth not ready, continuing as not logged in");
      _initialized = false;
      return ctInitNotLoggedIn();
    }

    TCA2.auth.checkLogin().then(resp => {
      root._ctCacheturUser = resp.username || "";
      root._ctLanguage = resp.language || "en";
      if (root.i18next) root.i18next.changeLanguage(root._ctLanguage);
      log.info("[TCA2] Cachetur language set to:", root._ctLanguage);

      if (!root._ctCacheturUser){
        log.info("[TCA2] Not logged in");
        _initialized = false;
        ctInitNotLoggedIn();
      } else {
        log.info("[TCA2] Login OK");
        _initialized = false;
        ctInit(true);
      }
    }).catch(err => {
      log.info("[TCA2] [core/auth.js] checkLogin failed", err);
      root._ctLanguage = 'en';
      if (root.i18next) root.i18next.changeLanguage(root._ctLanguage);
      log.info("[TCA2] Cachetur language set to:", root._ctLanguage);
      log.info("[TCA2] Not logged in");
      _initialized = false;
      ctInitNotLoggedIn();
    });
  }

  function ctInvalidateLogin(){
    root._ctCacheturUser = '';
    const el = document.getElementById('cachetur-header');
    if (el) el.remove();
  }

  function ctInit(force){
    // placeholder for full init; mark last action time
    if (typeof GM_setValue !== 'undefined') GM_setValue("cachetur_last_action", Date.now());
  }

  function ctInitNotLoggedIn(){
    // placeholder for guest mode
  }

  function ctInitInactive(){
    log.info("[TCA2] Init inactive state");
    ctPreInit();
  }

  // Wire up the bus activation
  if (TCA2.bus && TCA2.bus.on){
    TCA2.bus.on('tca2:activate', function(){
      log.info("[TCA2] [app/ct-start.js] Activation requested");
      root._ctPage = getCtPage();
      ctStart();
    });
  }

  // Export some helpers (optional)
  TCA2.app = Object.assign(TCA2.app || {}, {
    ctStart, ctPreInit, ctCheckLogin, ctInvalidateLogin, ctInit, ctInitNotLoggedIn, ctInitInactive
  });

  log.info('[TCA2] [app/ct-start.js] Bus ready');
  log.info('[TCA2] [app/ct-start.js] Loaded');
})();