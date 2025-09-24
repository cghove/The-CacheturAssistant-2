// [TCA2] app/ct-start.js
// This module was split from the original monolithic userscript. All logs are in English.
(function() {
  try {
    console.log("[TCA2] [app/ct-start.js] Loaded");


        function ctStart()
        {


            let lastUse = GM_getValue("cachetur_last_action", 0);
            let timeSinceLastUse = (Date.now() - lastUse) / 1000;
            console.log("The Cachetur Assistant was last used " + timeSinceLastUse + " seconds ago");

            if (timeSinceLastUse > 3600)
            {

                ctInitInactive();

            }
            else
            {
                ctPreInit();
            }
        }




        function ctPreInit()
        {
            console.log("Continuing init of Cacheturassistenten");
            if (_ctPage !== "pgc_map" && _ctPage !== "pgc_map2" && _ctPage !== "pgc_vgps" && _ctPage !== "bobil" && _ctPage !== "gc_map_new" && _ctPage !== "gc_gctour" && _ctPage !== "gc_map" && _ctPage !== "gc_geocache" && _ctPage !== "gc_bmlist" && $(".logged-in-user").length < 1)
            {
                $(document).bind("DOMSubtreeModified.cachetur-init", function ()
                {
                    if ($(".profile-panel.detailed").length > 0)
                    {
                        $(document).unbind("DOMSubtreeModified.cachetur-init");
                        ctCheckLogin();
                    }
                });
            }
            else if (_ctPage === "gc_map_new" || _ctPage === "gc_gctour")
            {
                ctCheckLogin();
            }
            else
            {
                ctCheckLogin();
            }
        }





        function ctCheckLogin()
        {
            console.log("Checking login");
            ctApiCall("user_get_current", "", function (response)
            {
                _ctCacheturUser = response.username || "";
                _ctLanguage = response.language || "en";
                i18next.changeLanguage(_ctLanguage);
                console.log("Cachetur language set to:", _ctLanguage);

                if (!_ctCacheturUser)
                {
                    console.log("Not logged in");
                    _initialized = false;
                    ctInitNotLoggedIn();
                }
                else
                {
                    console.log("Login OK");
                    _initialized = false;
                    ctInit(true);
                }
            });
        }



        function ctApiCall(call, params, callback)
        {
            let appId = "Cacheturassistenten " + GM_info.script.version + " - " + _ctPage;

            GM_xmlhttpRequest(
            {
                method: "POST",
                url: "https://cachetur.no/api/" + call,
                data: "appid=" + encodeURIComponent(appId) + "&json=" + encodeURIComponent(JSON.stringify(params)),
                withCredentials: true,
                crossDomain: true,
                headers:
                {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                onload: function (data)
                {
                    try
                    {
                        let response = $.parseJSON(data.responseText);

                        if (response.error === "UNAUTHORIZED")
                        {
                            ctInvalidateLogin();
                            callback("");
                        }

                        if (response.error.length <= 0)
                        {
                            callback(response.data);
                        }
                        else
                        {
                            callback("");
                        }
                    }
                    catch (e)
                    {
                        console.warn("Failed to verify response from cachetur.no: " + e);
                        callback("");
                    }
                },
                onerror: function ()
                {
                    callback("");
                },
                ontimeout: function ()
                {
                    callback("");
                }
            });
        }
    console.log("[TCA2] [app/ct-start.js] Ready");
  } catch (e) {
    console.error("[TCA2] [app/ct-start.js] Error during module execution", e);
  }
})();
