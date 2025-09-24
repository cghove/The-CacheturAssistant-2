// [TCA2] core/env.js
// Purpose: shared helpers, GM wrappers, repo config.
(function(){
  console.log("[TCA2] [env] Loaded");

  // Repo configuration + RAW() utility (can be overridden by bootloader)
  window.REPO = window.REPO || { owner: "XXXX", name: "XXXX", branch: "main" };
  window.RAW  = function(path){ return "https://raw.githubusercontent.com/" + window.REPO.owner + "/" + window.REPO.name + "/" + window.REPO.branch + "/" + path; };
  window.MANIFEST_URL = window.RAW ? window.RAW("manifest.json") : null;
  window.CACHE_KEY = window.CACHE_KEY || "tca2_cache";

  // Logging helpers
  window.clog = function(){ var a=[].slice.call(arguments); a.unshift("[TCA2]"); console.log.apply(console, a); };
  window.cerr = function(){ var a=[].slice.call(arguments); a.unshift("[TCA2]"); console.error.apply(console, a); };

  // GM wrappers
  window.gmGet = function(k, d){ try{ return GM_getValue(k, d); }catch(_){ return d; } }
  window.gmSet = function(k, v){ try{ GM_setValue(k, v); }catch(_){ } }

  window.httpGet = function(url, timeout){
    timeout = timeout || 30000;
    return new Promise(function(resolve, reject){
      if (typeof GM_xmlhttpRequest !== "function") { reject(new Error("GM_xmlhttpRequest not available; @grant may be missing.")); return; }
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        headers: { "Accept": "text/plain; charset=utf-8" },
        timeout: timeout,
        onload: function(r){ (r.status>=200 && r.status<300) ? resolve(r.responseText) : reject(new Error("HTTP "+r.status+" for "+url)); },
        onerror: reject,
        ontimeout: function(){ reject(new Error("timeout "+url)); }
      });
    });
  };

  // Small utils
  window.tca2_sha1like = function(s){
    var h=0,i,chr; if (!s || s.length===0) return "0";
    for (i=0;i<s.length;i++){ chr=s.charCodeAt(i); h=((h<<5)-h)+chr; h|=0; }
    return String(h>>>0);
  };

  console.log("[TCA2] [env] Ready");
})();
