// [core/i18n.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  if (typeof root.i18next === 'undefined') {
    log.info('[TCA2] [core/i18n.js] i18next was not found (@require missing?)');
    return;
  }

  const { ctApiCall } = (TCA2.api || {});
  if (!ctApiCall){
    log.warn('[TCA2] [core/i18n.js] TCA2.api.ctApiCall missing; skipping i18n init');
    return;
  }

  function gmAjax(url, options, callback) {
    // i18next-xhr-backend custom ajax to avoid CORS
    try {
      GM_xmlhttpRequest({
        method: options && options.type ? options.type : 'GET',
        url: url,
        headers: options && options.headers ? options.headers : {},
        data: options && options.data ? options.data : null,
        responseType: 'text',
        onload: (res) => callback(res.responseText, res),
        onerror: () => callback('', { status: 0, statusText: 'error' }),
        ontimeout: () => callback('', { status: 0, statusText: 'timeout' })
      });
    } catch(e){
      log.warn('[TCA2] [core/i18n.js] gmAjax exception', e);
      callback('', { status: 0, statusText: 'exception' });
    }
  }

  function startI18n(selectedLanguage){
    root.i18next
      .use(root.i18nextXHRBackend)
      .use(root.i18nextBrowserLanguageDetector)
      .init({
        whitelist: ['nb_NO','en','de_DE','sv_SE','en_US','da_DK','nl_NL','fr_FR','cs_CZ','fi_FI','es_ES'],
        preload:  ['nb_NO','en','de_DE','sv_SE','en_US','da_DK','nl_NL','fr_FR','cs_CZ','fi_FI','es_ES'],
        fallbackLng: ['en','en_US','nb_NO'],
        lng: selectedLanguage,
        ns: ['cachetur','common'],
        defaultNS: 'cachetur',
        backend: {
          loadPath: 'https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json',
          crossDomain: true,
          ajax: gmAjax
        }
      }, (err) => {
        if (err) {
          if ((''+err).indexOf('failed parsing')>-1) {
            root.i18next.changeLanguage('en_US');
            return startI18n('en_US');
          }
          log.warn('[TCA2] [core/i18n.js] init error:', err);
          return;
        }
        log.info('[TCA2] [core/i18n.js] Ready, language:', root.i18next.language);
        TCA2.bus && TCA2.bus.emit('i18n:ready', root.i18next.language);
      });
  }

  // Load user language via Cachetur API first
  ctApiCall("user_get_current", "", function(response){
    let selectedLanguage = 'en';
    if (response && response.username && response.language) {
      selectedLanguage = response.language;
      log.info('[TCA2] [core/i18n.js] Using preferred language from API:', selectedLanguage);
    } else {
      const browserLanguage = navigator.language || navigator.userLanguage || 'en';
      selectedLanguage = browserLanguage;
      log.info('[TCA2] [core/i18n.js] Using browser language:', selectedLanguage);
    }
    startI18n(selectedLanguage);
  });
})();