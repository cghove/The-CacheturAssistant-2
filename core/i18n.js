// [TCA2] core/i18n.js
(function () {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);

  // Ensure the global $ from jQuery is available for legacy modules
  if (!root.$ && root.jQuery) root.$ = root.jQuery;

  if (typeof root.i18next === 'undefined') {
    log.log('[core/i18n.js] i18next was not found (@require missing?)');
    // Soft no-op: provide a tiny shim so calls don’t crash
    TCA2.t = (k) => k;
    return;
  }

  // Use GM_xmlhttpRequest to bypass site CORS & X-Requested-With header
  function gmAjax(url, options, callback, data) {
    try {
      GM_xmlhttpRequest({
        method: (options && options.type) || (data ? 'POST' : 'GET'),
        url,
        data: data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null,
        headers: Object.assign(
          { 'Accept': 'application/json' },
          (options && options.headers) || {}
        ),
        responseType: 'text',
        withCredentials: true,    // << important so Cachetur cookies are sent
        onload: (res) => callback(res.responseText, res),
        onerror: (err) => callback('', err),
        ontimeout: () => callback('', { status: 0, statusText: 'timeout' }),
      });
    } catch (e) {
      callback('', { status: 0, statusText: e && e.message || 'gmAjax error' });
    }
  }

  const lngDetector = root.i18nextBrowserLanguageDetector;
  const xhrBackend = root.i18nextXHRBackend;

  root.i18next
    .use(xhrBackend)
    .use(lngDetector)
    .init({
      fallbackLng: 'en',
      ns: ['common'],
      defaultNS: 'common',
      backend: {
        loadPath: 'https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json',
        ajax: gmAjax, // << override to avoid CORS/preflight header
      },
      detection: {
        order: ['cookie', 'localStorage', 'navigator'],
        caches: [], // don’t write new cookies
      },
      interpolation: { escapeValue: false },
      returnEmptyString: false,
    }, function (err) {
      if (err) {
        log.log('[core/i18n.js] init error:', err);
      } else {
        log.log('[core/i18n.js] ready');
      }
    });

  // Public translator (modules use TCA2.t)
  TCA2.t = function (key, opts) {
    try { return root.i18next.t(key, opts); }
    catch { return key; }
  };
})();
