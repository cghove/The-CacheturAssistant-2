// [TCA2] core/auth.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  function tryUrls(method){
    // Try a few likely endpoints; first one that returns JSON wins
    const base = [
      'https://cachetur.no/monkey',
      'https://www.cachetur.no/monkey',
      'https://cachetur.no',
      'https://www.cachetur.no'
    ];
    const paths = [
      '/api.php?action=',
      '/api/',
      '/monkey/',
      '/'
    ];
    const guesses = [];
    base.forEach(b=>{
      // specific legacy patterns
      guesses.push(b + '/monkey/api.php?action=' + method);
      guesses.push(b + '/monkey/api/' + method);
      guesses.push(b + '/api/monkey/' + method);
      guesses.push(b + '/api.php?action=' + method);
      guesses.push(b + '/api/' + method);
    });
    // De-duplicate
    const seen = new Set(); const out = [];
    for (const u of guesses){ if (!seen.has(u)) { seen.add(u); out.push(u); } }
    return out;
  }

  function gmGetJSON(url){
    return new Promise((resolve, reject)=>{
      if (!TCA2.gm || !TCA2.gm.xhr) return reject(new Error('GM_xmlhttpRequest unavailable'));
      TCA2.gm.xhr({
        method: 'GET',
        url,
        headers: {'Accept':'application/json'},
        onload: (resp)=>{
          try {
            const j = JSON.parse(resp.responseText);
            resolve(j);
          } catch(e){
            reject(e);
          }
        },
        onerror: (e)=>reject(e)
      });
    });
  }

  async function ctApiCall(method){
    const urls = tryUrls(method);
    for (const u of urls){
      try {
        const data = await gmGetJSON(u);
        return data;
      } catch(e){ /* try next */ }
    }
    throw new Error('All API URL guesses failed for ' + method);
  }

  async function checkLogin(){
    try {
      const res = await ctApiCall('user_get_current');
      const username = (res && (res.username || res.user || res.name)) || '';
      const language = (res && (res.language || res.lang)) || (typeof i18next !== 'undefined' ? i18next.language : 'en');
      if (typeof i18next !== 'undefined' && language) {
        try { i18next.changeLanguage(language); } catch(e){}
      }
      TCA2.bus.emit('auth:ok', { username, language, raw: res });
      return { ok: true, username, language };
    } catch(e){
      TCA2.bus.emit('auth:none', {});
      return { ok: false };
    }
  }

  TCA2.auth = { checkLogin, ctApiCall };
})();