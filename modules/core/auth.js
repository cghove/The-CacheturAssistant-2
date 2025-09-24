// [core/auth.js]
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  const { ctApiCall } = (TCA2.api || {});

  TCA2.auth = {
    checkLogin: function(){
      return new Promise((resolve, reject) => {
        if (!ctApiCall) return reject(new Error('API not ready'));
        ctApiCall('user_get_current', "", function(resp){
          if (!resp) return reject(new Error('No data'));
          resolve(resp);
        });
      });
    },
    invalidate: function(){
      try {
        root._ctCacheturUser = '';
        const header = document.getElementById('cachetur-header');
        if (header) header.remove();
      } catch(e){}
    }
  };

  log.info('[TCA2] [core/auth.js] Ready');
})();