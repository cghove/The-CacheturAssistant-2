// [TCA2] core/api.js
(function () {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  // Ensure jQuery is globally reachable as $
  if (!root.$ && root.jQuery) root.$ = root.jQuery;

  function ctApiCall(call, params, callback) {
    try {
      const pageId = (root._ctPage || TCA2.pageId || 'unknown');
      const ver = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '0';
      const appId = `Cacheturassistenten ${ver} - ${pageId}`;

      // Prefer native GM API if available (TM/GM variants)
      const gmXHR = (typeof GM_xmlhttpRequest === 'function')
        ? GM_xmlhttpRequest
        : (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function')
          ? GM.xmlHttpRequest
          : null;

      if (!gmXHR) throw new Error('GM_xmlhttpRequest not available (module must run in userscript sandbox)');

      gmXHR({
        method: 'POST',
        url: `https://cachetur.no/api/${call}`,
        data: `appid=${encodeURIComponent(appId)}&json=${encodeURIComponent(JSON.stringify(params || {}))}`,
        withCredentials: true,
        crossDomain: true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        onload: function (data) {
          try {
            // Keep $.parseJSON as in original code
            const response = root.$ && root.$.parseJSON ? root.$.parseJSON(data.responseText) : JSON.parse(data.responseText);

            if (response && response.error === 'UNAUTHORIZED') {
              if (typeof root.ctInvalidateLogin === 'function') root.ctInvalidateLogin();
              return callback && callback('');
            }

            if (response && (response.error === '' || (typeof response.error === 'string' && response.error.length <= 0))) {
              return callback && callback(response.data);
            }

            // Any other error → empty payload per original contract
            callback && callback('');
          } catch (e) {
            log.warn('[TCA2] Failed to verify response from cachetur.no:', e);
            callback && callback('');
          }
        },
        onerror: function () { callback && callback(''); },
        ontimeout: function () { callback && callback(''); }
      });
    } catch (e) {
      log.warn('[TCA2] ctApiCall setup error:', e);
      callback && callback('');
    }
  }

  TCA2.api = TCA2.api || {};
  TCA2.api.ctApiCall = ctApiCall;
  // Back-compat with legacy global calls
  root.ctApiCall = ctApiCall;
})();
