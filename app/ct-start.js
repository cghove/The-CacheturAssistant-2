// [TCA2] app/ct-start.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;
  const $ = root.$ || root.jQuery;

  // state used by legacy code pieces
  let _initialized = false;
  let _ctCacheturUser = "";
  let _ctLanguage = "en";
  let _ctPage = (TCA2.page && (TCA2.page.isGCMap ? "gc_map" : TCA2.page.isGCListing ? "gc_geocache" : TCA2.page.isPGC ? "pgc" : TCA2.page.isCachetur ? "cachetur" : "other")) || "other";

  function ctStart(){
    let lastUse = (typeof GM_getValue !== 'undefined') ? GM_getValue("cachetur_last_action", 0) : 0;
    let timeSinceLastUse = (Date.now() - lastUse) / 1000;
    log.info("The Cachetur Assistant was last used " + timeSinceLastUse + " seconds ago");

    if (timeSinceLastUse > 3600){
      ctInitInactive();
    } else {
      ctPreInit();
    }
  }

  function ctPreInit(){
    log.info("Continuing init of Cachetur Assistant");
    // The original script had a lot of page-specific DOM checks; simplify and always check login now
    ctCheckLogin();
  }

  function ctCheckLogin(){
    log.info("Checking login");
    if (!TCA2.auth || !TCA2.auth.checkLogin){
      // If auth module not ready, assume not logged in for now
      _ctLanguage = "en";
      if (root.i18next){ try{ root.i18next.changeLanguage(_ctLanguage); }catch(_){} }
      log.info("Not logged in (auth missing)");
      _initialized = false;
      return ctInitNotLoggedIn();
    }

    TCA2.auth.checkLogin().then(response => {
      _ctCacheturUser = response.username || "";
      _ctLanguage = response.language || "en";
      if (root.i18next){ try{ root.i18next.changeLanguage(_ctLanguage); }catch(_){} }
      log.info("Cachetur language set to:", _ctLanguage);

      if (!_ctCacheturUser){
        log.info("Not logged in");
        _initialized = false;
        ctInitNotLoggedIn();
      } else {
        log.info("Login OK");
        _initialized = false;
        ctInit(true);
      }
    }).catch(err => {
      log.info("[core/auth.js] checkLogin failed", err);
      _ctLanguage = "en";
      if (root.i18next){ try{ root.i18next.changeLanguage(_ctLanguage); }catch(_){} }
      log.info("Cachetur language set to:", _ctLanguage);
      log.info("Not logged in");
      _initialized = false;
      ctInitNotLoggedIn();
    });
  }

  function ctInvalidateLogin(){
    _ctCacheturUser = '';
    if ($){ $("#cachetur-header").remove(); }
  }

  function ctInit(active){
    // Place for actual init when logged in
    // e.g. start listeners, augment UI, etc.
    // For now just update last action stamp
    if (typeof GM_setValue !== 'undefined') GM_setValue("cachetur_last_action", Date.now());
  }

  function ctInitNotLoggedIn(){
    // Show minimal UI state if needed
  }

  function ctInitInactive(){
    log.info("Init inactive state");
    // In inactive mode we still run pre-init
    ctPreInit();
  }

  // Bus wiring (activation via header link)
  if (TCA2.bus && TCA2.bus.on){
    TCA2.bus.on("tca2:activate", function(){
      log.info("[app/ct-start.js] Activation requested");
      ctStart();
    });
  }

  log.info("[app/ct-start.js] Bus ready");
  log.info("[app/ct-start.js] Loaded");
})();
