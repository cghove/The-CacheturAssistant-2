// [TCA2] core/auth.js
(function () {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);

  // endpoints observed in older TCA
  const ENDPOINTS = [
    // Clean endpoints
    'https://cachetur.no/monkey/user_get_current',
    'https://www.cachetur.no/monkey/user_get_current',
    'https://cachetur.net/monkey/user_get_current',
    'https://www.cachetur.net/monkey/user_get_current',

    // Legacy "api?method=" style
    'https://cachetur.no/monkey/api?method=user_get_current',
    'https://www.cachetur.no/monkey/api?method=user_get_current',
    'https://cachetur.net/monkey/api?method=user_get_current',
    'https://www.cachetur.net/monkey/api?method=user_get_current',

    // Legacy "api.php?method=" style (belt & suspenders)
    'https://cachetur.no/monkey/api.php?method=user_get_current',
    'https://www.cachetur.no/monkey/api.php?method=user_get_current',
    'https://cachetur.net/monkey/api.php?method=user_get_current',
    'https://www.cachetur.net/monkey/api.php?method=user_get_current',
  ];

  function gmFetchJson(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { 'Accept': 'application/json' },
        responseType: 'text',
        withCredentials: true, // << carry Cachetur login cookie
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            try {
              const json = JSON.parse(res.responseText);
              resolve(json);
            } catch (e) {
              reject(new Error('Bad JSON from ' + url));
            }
          } else {
            reject(new Error('HTTP ' + res.status + ' for ' + url));
          }
        },
        onerror: () => reject(new Error('Network error for ' + url)),
        ontimeout: () => reject(new Error('Timeout for ' + url)),
      });
    });
  }

  async function checkLogin() {
    let lastErr;
    for (const url of ENDPOINTS) {
      try {
        const r = await gmFetchJson(url);
        // Accept shapes {username, language} or nested {data:{username,language}}
        const data = (r && r.data) ? r.data : r;
        if (data && (data.username || data.user || data.name)) {
          return {
            username: data.username || data.user || data.name || '',
            language: data.language || data.lang || 'en',
          };
        }
        // If the server returns {ok:false} / {error:...}, treat as failure
        lastErr = new Error('Unexpected payload from ' + url);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('No endpoint succeeded');
  }

  TCA2.auth = { checkLogin };
})();
