// [TCA2] app/ct-start.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;
  const gm = TCA2.gm || { getValue:()=>null, setValue:()=>null };

  // Legacy globals expected by old modules
  root._ctCacheturUser = root._ctCacheturUser || '';
  root._ctLanguage = root._ctLanguage || 'en';
  root._initialized = root._initialized || false;

  function setLastUse() {
    try { gm.setValue('cachetur_last_action', Date.now()); } catch(e){}
  }

  function ctInitInactive(){
    // Show "Activate" in header; nothing else to do here
    log.info('[app/ct-start.js] Init inactive (last use was long ago)');
  }

  function ctInitNotLoggedIn(){
    // User not logged into Cachetur (per API). Keep assistant in inactive state.
    log.info('[app/ct-start.js] Not logged into Cachetur.');
    updateHeaderText('Activate the Cachetur Assistant');
  }

  function ctInit(loggedIn){
    log.info('[app/ct-start.js] Init', {loggedIn});
    if (loggedIn) {
      updateHeaderText('Cachetur Assistant active');
    } else {
      updateHeaderText('Activate the Cachetur Assistant');
    }
  }

  function updateHeaderText(text){
    const el = document.querySelector('#cachetur-header-text');
    if (!el) return;
    if (text && el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE){
      el.firstChild.textContent = text;
    } else {
      // structure: [img] <a id="cachetur-activate">text</a>
      const a = document.getElementById('cachetur-activate');
      if (a) a.textContent = text;
    }
  }

  function ctPreInit(){
    log.info('[app/ct-start.js] PreInit');
    // For our v2 modules we simply move to login check
    ctCheckLogin();
  }

  function ctCheckLogin(){
    log.info('[app/ct-start.js] Checking login');
    if (!TCA2.auth || !TCA2.auth.checkLogin) {
      log.warn('[app/ct-start.js] TCA2.auth not available');
      root._initialized = false;
      ctInitNotLoggedIn();
      return;
    }
    TCA2.auth.checkLogin().then(res=>{
      root._ctCacheturUser = res.ok ? (res.username || '') : '';
      root._ctLanguage = res.ok ? (res.language || 'en') : (typeof i18next !== 'undefined' ? i18next.language : 'en');
      if (typeof i18next !== 'undefined') {
        try { i18next.changeLanguage(root._ctLanguage); } catch(e){}
      }
      if (!root._ctCacheturUser) {
        log.info('[app/ct-start.js] Not logged in');
        root._initialized = false;
        ctInitNotLoggedIn();
      } else {
        log.info('[app/ct-start.js] Login OK for', root._ctCacheturUser);
        root._initialized = false;
        ctInit(true);
      }
    });
  }

  function ctInvalidateLogin(){
    root._ctCacheturUser = '';
    const header = document.getElementById('cachetur-header');
    if (header) header.remove();
  }

  function ctStart(){
    const lastUse = gm.getValue('cachetur_last_action', 0);
    const timeSince = (Date.now() - (lastUse||0)) / 1000;
    log.info('[app/ct-start.js] Last used', timeSince, 'seconds ago');
    setLastUse();
    if (timeSince > 3600){
      ctInitInactive();
    } else {
      ctPreInit();
    }
  }

  // Wire events from header
  if (TCA2.bus && TCA2.bus.on){
    TCA2.bus.on('tca2:activate', function(){
      log.info('[app/ct-start.js] Activation requested');
      ctStart();
    });
  }

  log.info('[app/ct-start.js] Bus ready');
  log.info('[app/ct-start.js] Loaded');
})();