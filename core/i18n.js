// [core/i18n.js]
(function(){
  'use strict';
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var TCA2 = root.TCA2 = root.TCA2 || {};
  var log = (TCA2.log || console);

  function setFallback(){
    TCA2.i18n = { t: function(k, opts){ return k; }, changeLanguage: function(){}, language: 'en' };
    TCA2.t = TCA2.i18n.t;
  }

  if (typeof root.i18next === 'undefined' || !root.i18next) {
    log.warn('[core/i18n.js] i18next was not found (@require missing?)');
    setFallback();
    return;
  }

  var lng = (navigator.language || 'en').split('-')[0];
  var i18n = root.i18next;
  var Backend = root.i18nextXHRBackend || root.i18nextHttpBackend; // support either name
  var Detector = root.i18nextBrowserLanguageDetector;

  // Custom AJAX to avoid preflight header issues, using GM_xmlhttpRequest
  function gmAjax(url, opts, callback) {
    try {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        headers: { 'Accept': 'application/json' },
        onload: function(res){
          if (res.status >= 200 && res.status < 300) {
            callback(res.responseText, res);
          } else {
            callback('', res);
          }
        },
        onerror: function(){
          callback('', { status: 0 });
        }
      });
    } catch (e) {
      callback('', { status: 0 });
    }
  }

  var useChain = i18n;
  if (Backend) useChain = useChain.use(Backend);
  if (Detector) useChain = useChain.use(Detector);

  useChain.init({
    debug: false,
    lng: lng,
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: 'https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json',
      ajax: gmAjax
    },
    detection: {
      order: ['cookie', 'localStorage', 'navigator'],
      caches: []
    }
  }, function(err){
    if (err) log.warn('[core/i18n.js] init error:', err);
    TCA2.i18n = i18n;
    TCA2.t = i18n.t.bind(i18n);
    log.info('[core/i18n.js] Ready');
    (TCA2.bus && TCA2.bus.emit) && TCA2.bus.emit('i18n:ready');
  });
})();