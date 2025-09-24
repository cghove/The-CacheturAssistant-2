// [core/api.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  function ctApiCall(call, params, callback){
    try {
      const appId = "Cacheturassistenten " + (typeof GM_info !== 'undefined' ? GM_info.script.version : 'dev') + " - " + (root._ctPage || '');
      const payload = "appid=" + encodeURIComponent(appId) + "&json=" + encodeURIComponent(JSON.stringify(params || ""));

      GM_xmlhttpRequest({
        method: "POST",
        url: "https://cachetur.no/api/" + call,
        data: payload,
        withCredentials: true,
        crossDomain: true,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        onload: function (res) {
          try {
            const resp = JSON.parse(res.responseText || '{}');
            if (resp && resp.error === "UNAUTHORIZED") {
              if (TCA2 && TCA2.auth && typeof TCA2.auth.invalidate === 'function') TCA2.auth.invalidate();
              return callback && callback("");
            }
            if (resp && resp.error && resp.error.length > 0) {
              log.warn("[TCA2] API error:", resp.error);
              return callback && callback("");
            }
            return callback && callback(resp.data || "");
          } catch(e){
            log.warn("[TCA2] Failed to parse API response:", e);
            return callback && callback("");
          }
        },
        onerror: function(){ callback && callback(""); },
        ontimeout: function(){ callback && callback(""); }
      });
    } catch(e){
      log.warn("[TCA2] ctApiCall exception:", e);
      callback && callback("");
    }
  }

  TCA2.api = { ctApiCall: ctApiCall };
  log.info('[TCA2] [core/api.js] Ready');
})();