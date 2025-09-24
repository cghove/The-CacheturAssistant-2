// [TCA2] core/i18n.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  // If i18next isn't included via @require, don't block anything.
  if (typeof root.i18next === 'undefined'){
    log.info("[core/i18n.js] i18next was not found (@require missing?)");
    return;
  }

  // lightweight backend that uses GM.xmlHttpRequest to avoid CORS problems
  const gmXHR = (typeof GM !== 'undefined' && GM.xmlHttpRequest) || (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest);
  const GMBackend = function(options){ this.init = function(){}; };
  GMBackend.type = 'backend';
  GMBackend.prototype.init = function(services, backendOptions, i18nextOptions){ this.options = backendOptions || {}; };
  GMBackend.prototype.read = function(language, namespace, callback){
    if (!gmXHR){ callback(new Error("GM xhr missing")); return; }
    const url = `https://cachetur.no/monkey/language/${namespace}.${language}.json`;
    gmXHR({
      method: "GET",
      url,
      responseType: "text",
      anonymous: false,
      onload: (res)=>{
        try{
          const json = JSON.parse(res.responseText || "{}");
          callback(null, json);
        }catch(e){
          callback(e);
        }
      },
      onerror: ()=>callback(new Error("xhr error")),
      ontimeout: ()=>callback(new Error("timeout"))
    });
  };

  function loadTranslations(){
    // get preferred language from Cachetur API, fallback to browser
    const detector = (navigator.language || navigator.userLanguage || "en").replace("-", "_");
    let selectedLanguage = detector;

    if (TCA2.api && TCA2.api.call){
      TCA2.api.call("user_get_current", "", function(response){
        if (response && response.username && response.language){
          selectedLanguage = response.language;
          log.info("[core/i18n.js] Using user language:", selectedLanguage);
        } else {
          log.info("[core/i18n.js] Using browser language:", selectedLanguage);
        }
        initI18n(selectedLanguage);
      });
    } else {
      initI18n(selectedLanguage);
    }
  }

  function initI18n(lng){
    const white = ['nb_NO','en','de_DE','sv_SE','en_US','da_DK','nl_NL','fr_FR','cs_CZ','fi_FI','es_ES'];
    try{
      root.i18next
        .use(GMBackend)
        .use(root.i18nextBrowserLanguageDetector || { type: 'languageDetector', detect: ()=>lng })
        .init({
          whitelist: white,
          preload: white,
          fallbackLng: white,
          lng: lng,
          ns: ['cachetur'],
          defaultNS: 'cachetur',
          backend: {},
        }, function(err, t){
          if (err){
            log.warn("[core/i18n.js] i18next init error:", err);
            try{ root.i18next.changeLanguage('en_US'); }catch(_){}
          } else {
            log.info("[core/i18n.js] i18n ready:", root.i18next.language);
          }
          // i18n is async, but we don't gate startup on it
        });
    }catch(e){
      log.warn("[core/i18n.js] i18n init threw:", e);
    }
  }

  loadTranslations();
})();
