// [core/auth.js]
(function(){
  'use strict';
  var root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var TCA2 = root.TCA2 = root.TCA2 || {};
  var log = (TCA2.log || console);

  // Simple API caller that tries multiple paths
  var BASES = [
    'https://cachetur.no',
    'https://www.cachetur.no',
    'https://cachetur.net',
    'https://www.cachetur.net'
  ];

  function tryEndpoints(paths){
    // returns a function(method, payload) promise that tries paths
    return function(method, payload){
      var endpoints = [];
      for (var i=0;i<BASES.length;i++){
        for (var j=0;j<paths.length;j++){
          endpoints.push(BASES[i] + paths[j] + method);
        }
      }
      function attempt(ix){
        if (ix >= endpoints.length) return Promise.reject(new Error('No endpoint succeeded'));
        var url = endpoints[ix];
        return TCA2.gm.xhr({ method: 'GET', url: url }).then(function(res){
          if (res.status>=200 && res.status<300 && res.responseText) {
            try { return JSON.parse(res.responseText); } catch(e){}
          }
          return attempt(ix+1);
        }).catch(function(){ return attempt(ix+1); });
      }
      return attempt(0);
    };
  }

  var callUser = tryEndpoints(['/monkey/', '/api/']);

  TCA2.api = {
    call: function(method, payload){ return callUser(method, payload); }
  };

  TCA2.auth = {
    checkLogin: function(){
      return TCA2.api.call('user_get_current', '').then(function(data){
        // Expect shape: { username, language }
        var user = {
          username: data && (data.username || data.user || data.name) || '',
          language: data && (data.language || data.lang || 'en') || 'en'
        };
        TCA2.user = user;
        if (TCA2.i18n && TCA2.i18n.changeLanguage) {
          TCA2.i18n.changeLanguage(user.language);
        }
        (TCA2.bus && TCA2.bus.emit) && TCA2.bus.emit(user.username ? 'auth:ok' : 'auth:none', user);
        return user;
      }).catch(function(err){
        log.warn('[core/auth.js] checkLogin failed', err);
        (TCA2.bus && TCA2.bus.emit) && TCA2.bus.emit('auth:none', { username: '', language: 'en' });
        return { username: '', language: 'en' };
      });
    }
  };
})();