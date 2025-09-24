// [TCA2] core/i18n.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  if (typeof i18next === 'undefined' || typeof i18nextXHRBackend === 'undefined') {
    log.warn('[core/i18n.js] i18next was not found (@require missing?)');
    return;
  }

  // Use XHR backend with a custom ajax that goes via GM_xmlhttpRequest to bypass CORS
  try { i18next.use(i18nextXHRBackend); } catch(e){}
  try { i18next.use(i18nextBrowserLanguageDetector); } catch(e){}

  function gmAjax(url, options, callback, data){
    if (!TCA2.gm || !TCA2.gm.xhr) {
      // Fallback to normal XHR if GM is unavailable
      const xhr = new XMLHttpRequest();
      xhr.open(data ? 'POST' : 'GET', url, true);
      xhr.onreadystatechange = function(){
        if (xhr.readyState === 4){
          callback(xhr.responseText, xhr);
        }
      };
      xhr.send(data);
      return;
    }
    TCA2.gm.xhr({
      method: data ? 'POST' : 'GET',
      url: url,
      headers: options && options.headers ? options.headers : {'Accept':'application/json'},
      data: data,
      onload: function(resp){ callback(resp.responseText, { status: resp.status, getResponseHeader: (n)=>resp.responseHeaders }); },
      onerror: function(){ callback('', { status: 0 }); }
    });
  }

  i18next.init({
    debug: false,
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: 'https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json',
      crossDomain: true,
      ajax: gmAjax
    },
    detection: { order: ['querystring','cookie','localStorage','navigator'] }
  }, function(err){
    if (err) log.warn('[core/i18n.js] i18next init error:', err);
    TCA2.t = function(key, opts){ try { return i18next.t(key, opts); } catch(e){ return key; } };
  });
})();