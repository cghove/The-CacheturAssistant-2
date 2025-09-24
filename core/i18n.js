// [TCA2] core/i18n.js
(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = (TCA2.log || console);

  if (typeof i18next === 'undefined') {
    log.warn('[core/i18n.js] i18next was not found (@require missing?)');
    return;
  }

  // Custom i18next backend that loads via GM_xmlhttpRequest (no CORS/X-Requested-With)
  function GMBackend(options = {}) {
    this.init = function(services, backendOptions, i18nextOptions) {
      this.services = services;
      this.options = Object.assign({ loadPath: '' }, backendOptions || {});
    };
    this.read = function(language, namespace, callback) {
      try {
        const url = this.options.loadPath
          .replace('{{lng}}', language)
          .replace('{{ns}}', namespace);
        TCA2.http.get(url, { json: true, anonymous: false })
          .then(data => callback(null, data))
          .catch(err => callback(err, false));
      } catch (e) {
        callback(e, false);
      }
    };
  }
  GMBackend.type = 'backend';

  function normalizeLang(lng) {
    if (!lng) return 'en';
    lng = String(lng);
    // prefer language-country if provided, else language only
    if (lng.indexOf('-') > -1) lng = lng.replace('-', '_');
    if (/^[a-z]{2}(_[A-Z]{2})$/.test(lng)) return lng; // ex: en_US, nb_NO
    if (/^[a-z]{2}$/.test(lng)) return lng;
    // last fallback
    return 'en';
  }

  function detectLanguage() {
    try {
      // 1) stored value (set elsewhere)
      const stored = (typeof GM_getValue !== 'undefined') ? GM_getValue('cachetur.language') : null;
      if (stored) return normalizeLang(stored);

      // 2) browser
      const nav = navigator.language || (navigator.languages && navigator.languages[0]);
      if (nav) return normalizeLang(nav);

    } catch (e) {
      // ignore
    }
    return 'en';
  }

  const userLng = detectLanguage();

  i18next
    .use(GMBackend)
    .init({
      lng: userLng,
      fallbackLng: 'en',
      debug: false,
      ns: ['common'],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      backend: {
        loadPath: 'https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json'
      }
    }, (err) => {
      if (err) {
        log.warn('[core/i18n.js] i18next init error:', err && err.message ? err.message : err);
      }
      TCA2.t = i18next.t.bind(i18next);
    });

  log.info('[core/i18n.js] Loaded');
})();
