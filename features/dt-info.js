// [TCA2] features/dt-info.js
// This module was split from the original monolithic userscript. All logs are in English.
(function() {
  try {
    console.log("[TCA2] [features/dt-info.js] Loaded");

        function tvinfostart()
        {
            // Respect the uc3 toggle; default to OFF if anything is unclear
            let enabled = false;
            try
            {
                enabled = !!(GM_config && typeof GM_config.get === "function" && GM_config.get("uc3"));
            }
            catch (e)
            {
                enabled = false;
            }
            if (!enabled) return;

            // Wait until the page-specific elements we need are present
            function isReady()
            {
                if (_ctPage === "gc_gctour") return !!document.querySelector("#gmCacheInfo .geotour-cache-info");
                if (_ctPage === "gc_map") return !!document.querySelector("#gmCacheInfo .code");
                if (_ctPage === "gc_map_new") return !!document.querySelector(".cache-preview-attributes");
                if (_ctPage === "gc_geocache") return !!document.querySelector("#ctl00_ContentBody_diffTerr");
                return true;
            }

            (function wait()
            {
                if (isReady())
                {
                    tvinfo();
                    return;
                }
                setTimeout(wait, 250);
            })();
        }





        function tvinfo()
        {

            if (_ctPage === "gc_geocache")
            {

                let resultDifficultyTerrainCaches = "";

                GM_xmlhttpRequest(
                {
                    method: "GET",
                    url: "https://www.geocaching.com/my/statistics.aspx",
                    onload: function (response)
                    {
                        const obj = $.parseHTML(response.responseText);
                        resultDifficultyTerrainCaches = $(obj).find("#DifficultyTerrainCaches");

                        let D = $("#ctl00_ContentBody_uxLegendScale").html();
                        D = D.substring(D.indexOf("stars/stars") + 11, D.indexOf(".gif")).replace("_", ".");
                        let T = $("#ctl00_ContentBody_Localize12").html();
                        T = T.substring(T.indexOf("stars/stars") + 11, T.indexOf(".gif")).replace("_", ".");

                        let nbDT = "0";
                        if (resultDifficultyTerrainCaches && resultDifficultyTerrainCaches.length)
                        {
                            nbDT = resultDifficultyTerrainCaches.find("#" + (((D - 1) * 2) + 1) + "_" + (((T - 1) * 2) + 1)).text() || "0";
                        }

                        // Clean any previous output to avoid duplicates
                        $("#ctl00_ContentBody .ct-dtinfo").remove();

                        if (nbDT !== "0")
                        {
                            $("#ctl00_ContentBody_diffTerr").before(
                                `<div class="ct-dtinfo">${i18next.t('dt.you')} ${nbDT} ${i18next.t('dt.caches')}</div><br>`
                            );
                        }
                        else
                        {
                            $("#ctl00_ContentBody_diffTerr").before(
                                `<div class="ct-dtinfo"><strong>${i18next.t('dt.new')}</strong></div><br>`
                            );
                            $("#ctl00_ContentBody_uxLegendScale").attr("style", "background-color: lightgreen");
                            $("#ctl00_ContentBody_Localize12").attr("style", "background-color: lightgreen");
                        }
                    }
                });

            }
            else if (_ctPage === "gc_map_new")
            {

                if ($('#GClh_II_running')[0] && $('gclh_nav#ctl00_gcNavigation')[0])
                {
                    const delay = (n) => new Promise(r => setTimeout(r, n * 2000)); // kept from your code, not used here
                }

                waitForKeyElements(".cache-preview-attributes", function ()
                {
                    let resultDifficultyTerrainCaches = "";

                    GM_xmlhttpRequest(
                    {
                        method: "GET",
                        url: "https://www.geocaching.com/my/statistics.aspx",
                        onload: function (response)
                        {
                            const obj = $.parseHTML(response.responseText);
                            resultDifficultyTerrainCaches = $(obj).find("#DifficultyTerrainCaches");

                            let D = document.querySelectorAll(".attribute-val")[0]?.innerHTML || "";
                            D = D.replace(",", ".");
                            let T = document.querySelectorAll(".attribute-val")[1]?.innerHTML || "";
                            T = T.replace(",", ".");

                            let nbDT = "0";
                            if (resultDifficultyTerrainCaches && resultDifficultyTerrainCaches.length)
                            {
                                nbDT = resultDifficultyTerrainCaches.find("#" + (((D - 1) * 2) + 1) + "_" + (((T - 1) * 2) + 1)).text() || "0";
                            }

                            // Clean previous outputs
                            $(".cache-preview-action-menu .ct-dtinfo, .header-top .ct-dtinfo").remove();

                            if (nbDT !== "0")
                            {
                                if ($('#GClh_II_running')[0] && $('gclh_nav#ctl00_gcNavigation')[0])
                                {
                                    $("div.cache-preview-action-menu").append(`<div class="ct-dtinfo">${i18next.t('dt.you')} ${nbDT} ${i18next.t('dt.caches')}</div><br>`);
                                }
                                $("div.header-top").append(`<div class="ct-dtinfo">${i18next.t('dt.you')} ${nbDT} ${i18next.t('dt.caches')}</div><br>`);
                            }
                            else
                            {
                                if ($('#GClh_II_running')[0] && $('gclh_nav#ctl00_gcNavigation')[0])
                                {
                                    $("div.cache-preview-action-menu").append(`<div class="ct-dtinfo">${i18next.t('dt.new')}</div>`);
                                }
                                $("div.header-top").append(`<div class="ct-dtinfo">${i18next.t('dt.new')}</div>`);
                            }
                        }
                    });

                });

            }
            else if (_ctPage === "gc_map")
            {

                waitForKeyElements(".code", function ()
                {
                    let resultDifficultyTerrainCaches = "";

                    GM_xmlhttpRequest(
                    {
                        method: "GET",
                        url: "https://www.geocaching.com/my/statistics.aspx",
                        onload: function (response)
                        {
                            const obj = $.parseHTML(response.responseText);
                            resultDifficultyTerrainCaches = $(obj).find("#DifficultyTerrainCaches");

                            let D = document.querySelectorAll("DD")[1]?.innerHTML || "";
                            D = D.substring(D.indexOf("stars/stars") + 11, D.indexOf(".gif")).replace("_", ".");
                            let T = document.querySelectorAll("DD")[4]?.innerHTML || "";
                            T = T.substring(T.indexOf("stars/stars") + 11, T.indexOf(".gif")).replace("_", ".");

                            let nbDT = "0";
                            if (resultDifficultyTerrainCaches && resultDifficultyTerrainCaches.length)
                            {
                                nbDT = resultDifficultyTerrainCaches.find("#" + (((D - 1) * 2) + 1) + "_" + (((T - 1) * 2) + 1)).text() || "0";
                            }

                            // Clean previous outputs
                            $("#gmCacheInfo .ct-dtinfo").remove();

                            if (nbDT !== "0")
                            {
                                $("#gmCacheInfo").append(`<div class="ct-dtinfo">${i18next.t('dt.you')} ${nbDT} ${i18next.t('dt.caches')}</div>`);
                            }
                            else
                            {
                                $("#gmCacheInfo").append(`<div class="ct-dtinfo">${i18next.t('dt.new')}</div>`);
                            }
                        }
                    });

                });

            }
            else if (_ctPage === "gc_gctour")
            {

                // Wait until the geotour popup is rendered
                waitForKeyElements("#gmCacheInfo .geotour-cache-info", function ()
                {
                    GM_xmlhttpRequest(
                    {
                        method: "GET",
                        url: "https://www.geocaching.com/my/statistics.aspx",
                        onload: function (response)
                        {
                            const obj = $.parseHTML(response.responseText);
                            const resultDifficultyTerrainCaches = $(obj).find("#DifficultyTerrainCaches");

                            const box = document.querySelector("#gmCacheInfo .geotour-cache-info") || document;

                            // Find DT images
                            const dDt = Array.from(box.querySelectorAll("dt")).find(dt => dt.textContent.trim().toLowerCase().startsWith("difficulty"));
                            const tDt = Array.from(box.querySelectorAll("dt")).find(dt => dt.textContent.trim().toLowerCase().startsWith("terrain"));
                            const dImg = dDt && dDt.nextElementSibling ? dDt.nextElementSibling.querySelector("img") : null;
                            const tImg = tDt && tDt.nextElementSibling ? tDt.nextElementSibling.querySelector("img") : null;

                            // Parse stars from title or src (".../1.5stars.png")
                            function parseStars(img)
                            {
                                if (!img) return NaN;
                                const title = img.getAttribute("title") || "";
                                let m = title.match(/^([0-9](?:\.[05])?)/);
                                if (m) return parseFloat(m[1]);
                                const src = img.getAttribute("src") || "";
                                m = src.match(/\/([0-9](?:\.5)?)stars\.(?:png|gif)$/i);
                                return m ? parseFloat(m[1]) : NaN;
                            }

                            const D = parseStars(dImg);
                            const T = parseStars(tImg);

                            let nbDT = "0";
                            if (!isNaN(D) && !isNaN(T) && resultDifficultyTerrainCaches.length)
                            {
                                const cellId = ((D - 1) * 2 + 1) + "_" + ((T - 1) * 2 + 1);
                                nbDT = resultDifficultyTerrainCaches.find("#" + cellId).text() || "0";
                            }

                            // Clean previous and append fresh
                            $("#gmCacheInfo .ct-dtinfo").remove();
                            if (nbDT !== "0")
                            {
                                $("#gmCacheInfo").append(`<div class="ct-dtinfo">${i18next.t('dt.you')} ${nbDT} ${i18next.t('dt.caches')}</div>`);
                            }
                            else
                            {
                                $("#gmCacheInfo").append(`<div class="ct-dtinfo">${i18next.t('dt.new')}</div>`);
                            }
                        }
                    });
                });

            }
            else
            {
                // No-op for other pages
            }
        }
    console.log("[TCA2] [features/dt-info.js] Ready");
  } catch (e) {
    console.error("[TCA2] [features/dt-info.js] Error during module execution", e);
  }
})();
