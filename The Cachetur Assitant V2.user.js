// ==UserScript==
// @name         The Cachetur Assitant V2
// @namespace    https://cachetur.no/
// @version      0.2.2
// @description  Bootloader that loads TCA2 modules live from GitHub
// @icon         https://cachetur.net/img/logo_top.png
// @author       Cachetur
// @match        *://www.geocaching.com/*
// @match        *://geocaching.com/*
// @match        *://project-gc.com/*
// @match        *://www.project-gc.com/*
// @match        *://cachetur.no/*
// @match        *://www.cachetur.no/*
// @match        *://cachetur.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_info
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @connect      github.com
// @connect      cachetur.no
// @connect      www.cachetur.no
// @connect      cachetur.net
// @connect      www.cachetur.net
// @connect      overpass-api.de
// @connect      overpass.kumi.systems
// @connect      overpass.openstreetmap.fr
// @connect      overpass.osm.ch
// @connect      nominatim.openstreetmap.org
// @connect      photon.komoot.io
// @run-at       document-start
// @require      https://code.jquery.com/jquery-latest.js
// @require      https://unpkg.com/i18next@22.4.9/i18next.min.js
// @require      https://unpkg.com/i18next-xhr-backend@3.2.2/i18nextXHRBackend.js
// @require      https://unpkg.com/i18next-browser-languagedetector@7.0.1/i18nextBrowserLanguageDetector.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// ==/UserScript==

(function() {
  'use strict';

  // --- Repo config (can be overridden by editing below) ---
  var REPO = { owner: "cghove", name: "The-CacheturAssistant-2", branch: "main" };
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var $ = root.jQuery || root.$ || null;

  // Expose namespace & minimal logger immediately so modules can rely on it
  var TCA2 = root.TCA2 = root.TCA2 || {};
  TCA2.log = TCA2.log || (function(c){ 
    if (!c) c = {log:function(){}, info:function(){}, warn:function(){}, error:function(){}};
    // prefix logger
    function wrap(fn){ return function(){ try { fn.apply(c, ["[TCA2]"].concat([].slice.call(arguments))); } catch(e){} }; }
    return { log: wrap(c.log||function(){}), info: wrap(c.info||c.log||function(){}), warn: wrap(c.warn||c.log||function(){}), error: wrap(c.error||c.log||function(){}) };
  })(root.console);
  TCA2.$ = $;
  var log = TCA2.log;

  var href = location.href;
  log.info("Bootloader: starting", { repo: REPO, url: href });

  // --- Helpers ---
  function ghRaw(path) {
    return "https://raw.githubusercontent.com/" + REPO.owner + "/" + REPO.name + "/" + REPO.branch + "/" + path;
  }

  function gmXhr(url, opts) {
    return new Promise(function(resolve, reject) {
      GM_xmlhttpRequest(Object.assign({
        method: 'GET',
        url,
        onload: function(res) {
          if (res.status >= 200 && res.status < 300) resolve(res);
          else reject(new Error("HTTP " + res.status + " for " + url));
        },
        onerror: function(err){ reject(err); }
      }, opts||{}));
    });
  }

  function gmEval(code, filename) {
    // Evaluate a module in page context
    try {
      (0,eval)(code + "\n//# sourceURL=" + filename);
    } catch (e) {
      error("Bootloader: eval failed " + filename, e);
      throw e;
    }
  }

  function info(){ log.info.apply(log, arguments); }
  function warn(){ log.warn.apply(log, arguments); }
  function error(){ log.error.apply(log, arguments); }

  // --- Page detect for conditional loads (very light) ---
  var isGC = /geocaching\.com/i.test(location.host);
  var isPGC = /project-gc\.com/i.test(location.host);
  var isCachetur = /cachetur\.(no|net)/i.test(location.host);
  var isGCMap = isGC && /\/(map|play\/map)/i.test(location.pathname);
  var isGCListing = isGC && (/\/geocache\//i.test(location.pathname) || /\/seek\/cache_details\.aspx/i.test(location.pathname));

  info("Bootloader: Detecting page…", { isGCMap, isGCListing, isPGC, isCachetur, href });

  // --- Fetch manifest ---
  function fetchManifest() {
    return gmXhr(ghRaw("manifest.json")).then(function(res){
      var json;
      try { json = JSON.parse(res.responseText); }
      catch(e){ throw new Error("Invalid manifest.json"); }
      info("Bootloader: Loaded manifest.json", json);
      return json;
    });
  }

  function shouldLoad(when) {
    if (!when) return true;
    if (when.gcMap && !isGCMap) return false;
    if (when.gcListing && !isGCListing) return false;
    if (when.pgc && !isPGC) return false;
    if (when.cachetur && !isCachetur) return false;
    return true;
  }

  function loadModule(mod) {
    if (!shouldLoad(mod.when)) return Promise.resolve(false);
    info("Bootloader: Loading", { path: mod.path, when: mod.when });
    var url = ghRaw(mod.path);
    return gmXhr(url).then(function(res){
      gmEval(res.responseText, mod.path);
      return true;
    }).catch(function(err){
      error("Bootloader: Module failed " + mod.path, err);
      return false;
    });
  }

  function run() {
    fetchManifest().then(async function(man) {
      var mods = man.modules || [];
      for (let m of mods) { await loadModule(m); }
      info("Bootloader: Done");
    }).catch(function(e){
      error("Bootloader: manifest error", e);
    });
  }

  run();
})();