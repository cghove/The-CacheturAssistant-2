// [TCA2] core/api.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  const gmXHR = (typeof GM !== 'undefined' && GM.xmlHttpRequest) || (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest);

  function ctApiCall(call, params, callback){
    try{
      const pageLabel = (TCA2.page && (TCA2.page.isGCMap ? "gc_map" : TCA2.page.isGCListing ? "gc_geocache" : TCA2.page.isPGC ? "pgc" : TCA2.page.isCachetur ? "cachetur" : "other")) || "other";
      const version = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : "dev";
      const appId = "Cacheturassistenten " + version + " - " + pageLabel;
      const body = "appid=" + encodeURIComponent(appId) + "&json=" + encodeURIComponent(JSON.stringify(params || ""));

      if (!gmXHR){
        log.warn("[core/api.js] GM xmlHttpRequest is not available; cannot call Cachetur API");
        callback("");
        return;
      }

      gmXHR({
        method: "POST",
        url: "https://cachetur.no/api/" + call,
        data: body,
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        responseType: "text",
        // ensure cookies are sent; TM sends them by default unless anonymous:true
        anonymous: false,
        onload: function (res){
          try{
            const text = res && res.responseText || "";
            const json = text ? JSON.parse(text) : null;
            if (!json){ callback(""); return; }
            if (json.error === "UNAUTHORIZED"){
              if (TCA2.auth && typeof TCA2.auth.invalidate === "function") TCA2.auth.invalidate();
              callback("");
              return;
            }
            if (!json.error || json.error.length === 0){
              callback(json.data);
            } else {
              callback("");
            }
          }catch(e){
            log.warn("[core/api.js] Failed to parse API response:", e);
            callback("");
          }
        },
        onerror: function(){ callback(""); },
        ontimeout: function(){ callback(""); }
      });
    }catch(e){
      log.warn("[core/api.js] ctApiCall exception:", e);
      callback("");
    }
  }

  TCA2.ctApiCall = ctApiCall;
  TCA2.api = { call: ctApiCall };

  TCA2.log.info("[core/api.js] Ready");
})();
