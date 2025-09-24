// [TCA2] core/auth.js
(function(){
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log || console;

  function checkLogin(){
    return new Promise((resolve, reject)=>{
      if (!TCA2.ctApiCall){ reject(new Error("ctApiCall missing")); return; }
      TCA2.ctApiCall("user_get_current", "", function(data){
        if (!data){ reject(new Error("No data")); return; }
        resolve(data);
      });
    });
  }

  function invalidate(){
    if (root.$){ $("#cachetur-header").remove(); }
  }

  TCA2.auth = { checkLogin, invalidate };
  log.info("[core/auth.js] Ready");
})();
