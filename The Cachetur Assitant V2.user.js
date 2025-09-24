// ==UserScript==
// @name         The Cachetur Assitant V2
// @namespace    https://cachetur.no/
// @version      0.0.0.1
// @description  Bootloader that loads TCA2 modules live from GitHub
// @match        *://www.geocaching.com/*
// @match        *://geocaching.com/*
// @match        *://project-gc.com/*
// @match        *://www.project-gc.com/*
// @match        *://cachetur.no/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function() {
  "use strict";
  var BOOTLOADER_VERSION = "0.2.0";
  var REPO = { owner: "XXXX", name: "XXXX", branch: "main" };
  function RAW(path){ return "https://raw.githubusercontent.com/" + REPO.owner + "/" + REPO.name + "/" + REPO.branch + "/" + path; }
  var MANIFEST_URL = RAW("manifest.json");
  var CACHE_KEY = "tca2_cache";

  function log(){ var a=[].slice.call(arguments); a.unshift("[TCA2]"); console.log.apply(console, a); }
  function err(){ var a=[].slice.call(arguments); a.unshift("[TCA2]"); console.error.apply(console, a); }

  function gmGet(k, d){ try{ return GM_getValue(k, d); }catch(_){ return d; } }
  function gmSet(k, v){ try{ GM_setValue(k, v); }catch(_){ } }

  function httpGet(url, timeout){
    timeout = timeout || 30000;
    return new Promise(function(resolve, reject){
      if (typeof GM_xmlhttpRequest !== "function") { reject(new Error("GM_xmlhttpRequest not available; @grant may be missing.")); return; }
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        headers: { "Accept": "text/plain; charset=utf-8" },
        timeout: timeout,
        onload: function(r){ (r.status>=200 && r.status<300) ? resolve({text:r.responseText, headers:r.responseHeaders||""}) : reject(new Error("HTTP "+r.status+" for "+url)); },
        onerror: reject,
        ontimeout: function(){ reject(new Error("timeout "+url)); }
      });
    });
  }

  var cache = gmGet(CACHE_KEY, { manifestVersion:null, modules:{} });

  function purgeCache(){
    try { gmSet(CACHE_KEY, { manifestVersion:null, modules:{} }); log("[cache] Purged"); } catch(e){ err("[cache] Purge error", e); }
  }

  var FORCE_COLD_START = false;
  if (FORCE_COLD_START || /[?&]tca_dev(=1)?\b/i.test(location.href)) purgeCache();
  try{ GM_registerMenuCommand && GM_registerMenuCommand("TCA2: Force reload modules", function(){ purgeCache(); location.reload(); }); }catch(_){}

  function sha1Like(s){
    var h=0,i,chr; if (!s || s.length===0) return "0";
    for (i=0;i<s.length;i++){ chr=s.charCodeAt(i); h=((h<<5)-h)+chr; h|=0; }
    return String(h>>>0);
  }

  function moduleMatches(mod, ctx){
    try{
      if (mod.when && mod.when.always) return true;
      if (mod.when && Array.isArray(mod.when.pages) && mod.when.pages.includes(ctx.page)) return true;
      if (mod.when && mod.when.host && new RegExp(mod.when.host).test(location.hostname)) return true;
      if (!mod.when) return true;
      return false;
    }catch(_){ return false; }
  }

  function detectPage(){
    try{
      var host = (location.hostname||"").toLowerCase();
      var path = (location.pathname||"").toLowerCase();
      var search = (location.search||"").toLowerCase();
      if (host==="geocaching.com"||host==="www.geocaching.com"){
        if (path.indexOf("/seek/")>=0 || path.indexOf("/geocache/")>=0) return "gc_geocache";
        if (path.indexOf("/plan/lists")>=0 || path.indexOf("/plan/")>=0) return "gc_bmlist";
        if (path==="/map" || path.indexOf("/map/")>=0) return "gc_map";
        if (path.indexOf("/play/map")>=0) return "gc_map_new";
        if (path.indexOf("/play/geotours")>=0) return "gc_gctour";
      }
      if (host.slice(-11)==="cachetur.no"){
        if (/^\/bobilplasser\/?/.test(path)) return "bobil";
        if (/^\/fellestur\/?/.test(path)) return "fellestur";
      }
      if (host==="project-gc.com"||host==="www.project-gc.com"){
        if (path.indexOf("/user/virtualgps")>=0 && search.indexOf("map=")<0) return "pgc_vgps";
        if (path.indexOf("/livemap/")>=0 || path.indexOf("/tools/")>=0) return "pgc_map";
        if (path.indexOf("/maps/")>=0) return "pgc_map2";
      }
      return "unknown";
    }catch(e){
      err("[detectPage] Error", e);
      return "unknown";
    }
  }

  function evalModule(code, name){
    try{
      (function(){ eval(code + "\n//# sourceURL="+name); }).call(unsafeWindow || window);
      log("[eval] OK", name);
      return true;
    }catch(e){
      err("[eval] Failed", name, e);
      return false;
    }
  }

  function semverGte(a, b){
    var pa = String(a||"").split('.').map(Number);
    var pb = String(b||"").split('.').map(Number);
    for (var i=0;i<Math.max(pa.length, pb.length);i++){
      var na = pa[i]||0, nb = pb[i]||0;
      if (na>nb) return true; if (na<nb) return false;
    }
    return true;
  }

  async function load(){
    var ctx = { page: detectPage() };
    log("[main] Page =", ctx.page);

    var manifest;
    try{
      var res = await httpGet(MANIFEST_URL, 20000);
      manifest = JSON.parse(res.text);
      log("[manifest] Loaded");
    }catch(e){
      err("[manifest] Fetch failed", e);
      var mods = Object.values(cache.modules||{}).filter(function(m){ return m && m.lastOk && moduleMatches(m.meta||{}, ctx); });
      mods.forEach(function(m){ evalModule(m.code, m.meta && m.meta.path || "cached"); });
      return;
    }

    if (manifest.minBootloader && !semverGte(BOOTLOADER_VERSION, manifest.minBootloader)) {
      alert("This version requires a newer bootloader. Please update 'The Cachetur Assitant V2' in Tampermonkey.");
      err("[compat] Bootloader too old. Have:", BOOTLOADER_VERSION, "Need:", manifest.minBootloader);
      return;
    }

    var wanted = (manifest.modules||[]).filter(function(m){ return moduleMatches(m, ctx); });

    for (var i=0;i<wanted.length;i++){
      var m = wanted[i];
      var key = m.path;
      var cached = (cache.modules||{})[key];
      var needsFetch = (!cached) || (m.hash && cached.hash !== m.hash) || (!m.hash && cached.metaHash !== sha1Like(JSON.stringify(m)));
      try{
        var useCode;
        if (needsFetch){
          var r = await httpGet(RAW(m.path), m.timeoutMs || 30000);
          useCode = r.text;
          cache.modules[key] = {
            code: useCode,
            hash: m.hash || null,
            fingerprint: sha1Like(useCode),
            metaHash: sha1Like(JSON.stringify(m)),
            meta: m,
            lastOk: true,
            ts: Date.now()
          };
          gmSet(CACHE_KEY, cache);
        } else {
          useCode = cached.code;
        }
        evalModule(useCode, m.path);
      }catch(e){
        err("[module] Load failed", m.path, e);
        if (cached && cached.lastOk){
          log("[module] Fallback to cached", m.path);
          evalModule(cached.code, m.path);
        }
      }
    }

    log("[main] Done");
  }

  load();
})();
