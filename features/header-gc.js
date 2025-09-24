// [TCA2] features/header-gc.js
// This module was split from the original monolithic userscript. All logs are in English.
(function() {
  try {
    console.log("[TCA2] [features/header-gc.js] Loaded");



        function ctInitNotLoggedIn()
        {
            if (_initialized) return;
            if (_ctPage === "gc_geocache" || _ctPage === "gc_bmlist" || _ctPage === "bobil") GM_addStyle("nav .wrapper { max-width: unset; } #cachetur-header { padding: 8px 1em 18px 2em; } #gc-header nav {align-items: center; box-sizing: border-box; display: flex; max-width: fit-content; min-height: 80px; overflow: visible; padding: 0 12px; position: relative !important; width: 100vw;} #cachetur-tur-valg { float:left; width: 200px; height: 24px; overflow: hidden; background: #eee; color: black; border: 1px solid #ccc; } #cachetur-header-text { padding-right: 3px; float:left; margin-top: -12px;  } ");
            else if (_ctPage === "gc_map_new" || _ctPage === "gc_gctour") GM_addStyle("#cachetur-header button { width: 26px; } #cachetur-header { ;padding-top:8px; } #cachetur-header-text { padding-right: 3px; float:left; margin-top: -12px; }");
            else if (_ctPage === "gc_map") GM_addStyle("#cachetur-header button { width: 26px; } #cachetur-header { ;padding-top:8px; } #cachetur-header-text { padding-right: 3px; float:left; margin-top: -12px; }");
            else if (_ctPage === "pgc_map" || _ctPage === "pgc_map2" || _ctPage === "pgc_vgps") GM_addStyle("#cachetur-header { margin-top: 7px; }");
            if ($('#GClh_II_running')[0] && $('gclh_nav#ctl00_gcNavigation')[0])
            {
                ctPrependToHeader2('<li id="cachetur-header"><span id="cachetur-header-text"><a href="https://cachetur.no/" target="_blank"><img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" /> ' + i18next.t('menu.notloggedin') + '<br>' + i18next.t('menu.deactivated') + '</span></a></li>');
                var liText = '',
                    liList = $('#ctl00_uxLoginStatus_divSignedIn li'),
                    listForRemove = [];

                $(liList).each(function ()
                {

                    var text = $(this).text();

                    if (liText.indexOf('|' + text + '|') == -1)
                        liText += '|' + text + '|';
                    else
                        listForRemove.push($(this));

                });

                $(listForRemove).each(function ()
                {
                    $(this).remove();
                });
            }
            else
            {
                ctPrependToHeader('<li id="cachetur-header"><span id="cachetur-header-text"><a href="https://cachetur.no/" target="_blank"><img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" /> ' + i18next.t('menu.notloggedin') + '<br>' + i18next.t('menu.deactivated') + '</span></a></li>');
                var liText2 = '',
                    liList2 = $('.user-menu li'),
                    listForRemove2 = [];

                $(liList2).each(function ()
                {

                    var text = $(this).text();

                    if (liText2.indexOf('|' + text + '|') == -1)
                        liText2 += '|' + text + '|';
                    else
                        listForRemove2.push($(this));

                });

                $(listForRemove2).each(function ()
                {
                    $(this).remove();
                });
            }


            _initialized = true;

        }
    console.log("[TCA2] [features/header-gc.js] Ready");
  } catch (e) {
    console.error("[TCA2] [features/header-gc.js] Error during module execution", e);
  }
})();
