// [TCA2] features/misc.js
// This module was split from the original monolithic userscript. All logs are in English.
(function() {
  try {
    console.log("[TCA2] [features/misc.js] Loaded");
    // === DRY helpers injected by refactor (phase 1) ===

    function ctInsert(data, $target, mode)
    {
        try
        {
            if ($target && typeof $target[mode] === 'function')
            {
                $target[mode](data);
            }
        }
        catch (e)
        {
            console.log("ctInsert error:", e);
        }
    }

    function ctIsGoogleMapsActive()
    {
        return !!(document.querySelector("script[src*='//maps.googleapis.com/']") ||
            document.querySelector("script[src*='maps.googleapis.com/maps-api-v3']") ||
            document.querySelector("script[src*='maps.googleapis.com/maps-api-v3.js']"));
    }

    // Optional marker helpers (not automatically wired to avoid regressions)
    function ctBuildDivIcon(html, className)
    {
        if (typeof L === 'undefined' || !L.divIcon) return null;
        return L.divIcon(
        {
            html: html,
            className: className || ''
        });
    }

    function ctBuildMarkersLayer(items)
    {
        if (!Array.isArray(items) || typeof L === 'undefined') return null;
        const markers = items.map(it => L.marker(it.latlng,
        {
            icon: it.icon
        }).bindPopup(it.popup || ""));
        return L.layerGroup(markers);
    }
    // === end DRY helpers ===


    /* globals jQuery, $, waitForKeyElements, L, i18next, i18nextXHRBackend, i18nextBrowserLanguageDetector, cloneInto, gm_config */

    this.$ = this.jQuery = jQuery.noConflict(true);
    let path = window.location.pathname;
    let _ctLastCount = 0;
    let _ctCacheturUser = "";
    let _ctLanguage = "";
    let _ctCodesAdded = [];
    let _ctPage = "unknown";
    let _routeLayer = [];
    let _waypointLayer = [];
    let _cacheLayer = [];
    let _initialized = false;
    let _ctNewMapActiveCache = "";
    let _ctBrowseMapActiveCache = "";
    let _codenm = "";
    let settings = "";
    let optionsHtml = "";

    console.log("Starting Cacheturassistenten V. " + GM_info.script.version);

    let pathname = window.location.pathname;
    let domain = document.domain;
    let href = window.location.href;

    // --- page detection ---
    /* [TCA2] extracted ctDetectPage */


    // Set the page EARLY (before logging and before page-specific hooks):
    _ctPage = ctDetectPage();
    console.log("Detected page:", _ctPage);


    // --- continue startup ---
    window.onload = function ()
    {
        // Note: _ctPage is already set above.
        console.log("Running in " + _ctPage + " mode");

        $(document).ready(function ()
        {
            loadTranslations();
        });
    /* [TCA2] extracted loadTranslations */


        /// --- Dirty trick: multi-context hook + property spy + prototype sniffer ---
        if (typeof _ctPage !== 'undefined' && (_ctPage === 'gc_map_new' || _ctPage === 'gc_gctour'))(function ()
        {
            const log = (...a) => console.info('[cachetur]', ...a);

            // 0) Property spy on gcMap – captures when the page sets it (now or later)
            (function installGcMapSpy()
            {
                try
                {
                    const d = Object.getOwnPropertyDescriptor(unsafeWindow, 'gcMap');
                    if (!d || d.configurable)
                    {
                        let _v = d && 'value' in d ? d.value : undefined;
                        Object.defineProperty(unsafeWindow, 'gcMap',
                        {
                            configurable: true,
                            enumerable: true,
                            get()
                            {
                                return _v;
                            },
                            set(v)
                            {
                                _v = v;
                                try
                                {
                                    unsafeWindow.cacheturGCMap = v;
                                }
                                catch
                                {}
                                unsafeWindow.__cacheturMapHookInstalled = true;
                                console.info('[cachetur] gcMap property spy captured a map instance');
                            }
                        });
                        console.debug('[cachetur] Installed gcMap property spy');
                    }
                    else
                    {
                        console.debug('[cachetur] gcMap not configurable; skipping property spy');
                    }
                }
                catch (e)
                {
                    console.warn('[cachetur] Failed installing gcMap property spy', e);
                }
            })();

            // 1) Find all Leaflet contexts (unsafeWindow, userscript window, same-origin iframes)
            function findLeafletContexts(rootDoc = document)
            {
                const out = [];
                const tryAdd = (win, label) =>
                {
                    try
                    {
                        if (win && win.L && win.L.Map) out.push(
                        {
                            win,
                            label
                        });
                    }
                    catch
                    {}
                };
                tryAdd(unsafeWindow, 'unsafeWindow');
                tryAdd(window, 'userscript window');
                const ifr = rootDoc.querySelectorAll('iframe');
                for (const f of ifr)
                {
                    try
                    {
                        tryAdd(f.contentWindow, `iframe:${f.id||f.name||'(anon)'}`);
                    }
                    catch
                    {}
                }
                return out;
            }

            // 2) Install hook in ONE context (ctor+factory wrap + prototype sniffer)
            function hookContext(ctx)
            {
                const
                {
                    win,
                    label
                } = ctx;
                try
                {
                    const L = win.L;
                    if (!L || !L.Map || win.__cacheturMapHookInstalled) return;

                    const OriginalMap = L.Map;
                    const OriginalFactory = typeof L.map === 'function' ? L.map : null;

                    // Prototype sniffer to capture already-existing maps on next interaction
                    try
                    {
                        const onceExpose = (fn) =>
                        {
                            let done = false;
                            return function (...args)
                            {
                                if (!done)
                                {
                                    done = true;
                                    try
                                    {
                                        unsafeWindow.cacheturGCMap = this;
                                        unsafeWindow.gcMap = this;
                                        unsafeWindow.__cacheturMapHookInstalled = true;
                                        console.info('[cachetur] Prototype sniffer captured existing map instance');
                                    }
                                    catch (e)
                                    {
                                        console.warn('[cachetur] Failed to expose captured map', e);
                                    }
                                }
                                return fn.apply(this, args);
                            };
                        };
                        const p = L.Map.prototype;
                        ['setView', 'fitBounds', 'addLayer', 'panTo', 'invalidateSize', 'remove'].forEach(m =>
                        {
                            if (typeof p[m] === 'function' && !p[m].__ctWrapped)
                            {
                                const orig = p[m];
                                p[m] = onceExpose(orig);
                                p[m].__ctWrapped = true;
                            }
                        });
                        console.debug('[cachetur] Prototype sniffer installed on', label);
                    }
                    catch (e)
                    {
                        console.warn('[cachetur] Prototype sniffer failed on', label, e);
                    }

                    // Wrap constructor and factory – decorate the instance, but return the real Leaflet Map
                    L.Map = function (div, options)
                    {
                        const map = new OriginalMap(div, options);
                        try
                        {
                            decorateMap(win, L, map);
                        }
                        catch (e)
                        {
                            console.warn('[cachetur] decorate failed', e);
                        }
                        try
                        {
                            unsafeWindow.cacheturGCMap = map;
                        }
                        catch
                        {}
                        try
                        {
                            unsafeWindow.gcMap = map;
                        }
                        catch
                        {}
                        unsafeWindow.__cacheturMapHookInstalled = true;
                        console.info('[cachetur] Map created & decorated in', label);
                        // Restore after first init in THIS context
                        L.Map = OriginalMap;
                        if (OriginalFactory) L.map = OriginalFactory;
                        return map;
                    };
                    Object.setPrototypeOf(L.Map, OriginalMap);
                    L.Map.prototype = OriginalMap.prototype;
                    for (const k of Object.getOwnPropertyNames(OriginalMap))
                    {
                        if (!(k in L.Map))
                        {
                            try
                            {
                                L.Map[k] = OriginalMap[k];
                            }
                            catch
                            {}
                        }
                    }
                    if (OriginalFactory)
                    {
                        L.map = function (div, opts)
                        {
                            return new L.Map(div, opts);
                        };
                    }

                    console.info('[cachetur] L.Map/L.map wrapped in', label, '; awaiting first initialization.');
                }
                catch (e)
                {
                    console.warn('[cachetur] hookContext failed for', ctx.label, e);
                }
            }

            // 3) Decoration: our pane + FeatureGroup + helper API (careful not to break page layers)
            function decorateMap(win, L, map)
            {
                if (!map.getPanes || !map.createPane) return;
                if (!map.getPanes()['ct-pane'])
                {
                    const pane = map.createPane('ct-pane');
                    pane.style.zIndex = '420';
                    pane.style.pointerEvents = 'none';
                }
                const ctRoot = L.featureGroup([]).addTo(map);
                const defaultStyle = {
                    pane: 'ct-pane'
                };
                const orig = {
                    addLayer: map.addLayer,
                    removeLayer: map.removeLayer,
                    setView: map.setView,
                    fitBounds: map.fitBounds,
                };
                map.addLayer = function (layer)
                {
                    try
                    {
                        map.__ct._seen.add(layer);
                    }
                    catch
                    {}
                    return orig.addLayer.call(this, layer);
                };
                map.removeLayer = function (layer)
                {
                    try
                    {
                        map.__ct._seen.delete(layer);
                    }
                    catch
                    {}
                    return orig.removeLayer.call(this, layer);
                };
                map.setView = function (c, z, o)
                {
                    return orig.setView.call(this, c, z, o);
                };
                map.fitBounds = function (b, o)
                {
                    return orig.fitBounds.call(this, b, o);
                };

                Object.defineProperty(map, '__ct',
                {
                    configurable: true,
                    enumerable: false,
                    value:
                    {
                        _seen: new WeakSet(),
                        root: ctRoot,
                        pane: 'ct-pane',
                        addMarker(lat, lng, opts = {})
                        {
                            const m = L.marker([lat, lng],
                            {
                                ...defaultStyle,
                                ...opts
                            });
                            ctRoot.addLayer(m);
                            return m;
                        },
                        addCircle(lat, lng, opts = {
                            radius: 50
                        })
                        {
                            const c = L.circle([lat, lng],
                            {
                                ...defaultStyle,
                                ...opts
                            });
                            ctRoot.addLayer(c);
                            return c;
                        },
                        addPolyline(latlngs, opts = {})
                        {
                            const pl = L.polyline(latlngs,
                            {
                                ...defaultStyle,
                                ...opts
                            });
                            ctRoot.addLayer(pl);
                            return pl;
                        },
                        addGeoJSON(geojson, opts = {})
                        {
                            const gj = L.geoJSON(geojson,
                            {
                                ...opts,
                                pane: opts.pane ?? 'ct-pane'
                            });
                            ctRoot.addLayer(gj);
                            return gj;
                        },
                        clear()
                        {
                            ctRoot.clearLayers();
                        },
                        bringToFront()
                        {
                            try
                            {
                                (map.getPane('ct-pane') ||
                                {}).style.zIndex = '650';
                            }
                            catch
                            {}
                            ctRoot.eachLayer(l => l.bringToFront && l.bringToFront());
                        },
                        sendToBack()
                        {
                            try
                            {
                                (map.getPane('ct-pane') ||
                                {}).style.zIndex = '350';
                            }
                            catch
                            {}
                            ctRoot.eachLayer(l => l.bringToBack && l.bringToBack());
                        },
                        listPageLayers()
                        {
                            const arr = [];
                            map.eachLayer(l =>
                            {
                                if (!ctRoot.hasLayer(l)) arr.push(l);
                            });
                            return arr;
                        }
                    }
                });
                try
                {
                    unsafeWindow.cacheturAddMarker = (lat, lng, opts) => map.__ct.addMarker(lat, lng, opts);
                }
                catch
                {}
            }

            // 4) Hook in all current contexts + auto-hook new iframes
            function hookAllContexts()
            {
                const ctxs = findLeafletContexts();
                ctxs.forEach(hookContext);
            }
            hookAllContexts();

            // When new iframes appear (GC often builds late), hook them as well
            const mo = new MutationObserver((muts) =>
            {
                let need = false;
                for (const m of muts)
                    for (const n of m.addedNodes)
                        if (n.tagName === 'IFRAME') need = true;
                if (need) hookAllContexts();
            });
            try
            {
                mo.observe(document.documentElement,
                {
                    childList: true,
                    subtree: true
                });
            }
            catch
            {}
        })();
        /// --- end ---

        // Wait until the page's Leaflet map (same one the script uses) is ready
        function ctWhenMapReady(cb,
        {
            timeoutMs = 30000,
            pollMs = 200
        } = {})
        {
            const t0 = Date.now();
            (function tick()
            {
                try
                {
                    const map = ctGetUnsafeLeafletObject(); // resolves unsafeWindow.cacheturGCMap on gc_map_new
                    if (map && typeof map.getBounds === 'function')
                    {
                        cb(map);
                        return;
                    }
                }
                catch (e)
                {}
                if (Date.now() - t0 >= timeoutMs)
                {
                    console.warn('[CT_POI] Timed out waiting for map');
                    return;
                }
                setTimeout(tick, pollMs);
            })();
        }

        /// Check for new version of the assistant (with README changelog toast + snooze)
        (function ()
        {
            // Use the RAW host to avoid redirect blocks (remember @connect raw.githubusercontent.com)
            const README_RAW_URL = "https://raw.githubusercontent.com/cachetur-no/cachetur-assistant/refs/heads/master/README.md";
            const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
            const LAST_NOTIFIED_KEY = "ct_last_notified_ver"; // {version:string, at:number}
            const REMIND_AFTER_MS = 24 * 60 * 60 * 1000; // remind again after 24h

            function escHtml(s)
            {
                return String(s || "").replace(/[&<>"']/g, c => (
                {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                } [c]));
            }

            function isNewerVersion(latest, current)
            {
                if (!latest || !current) return false;
                const a = latest.split(".").map(Number),
                    b = current.split(".").map(Number);
                for (let i = 0, len = Math.max(a.length, b.length); i < len; i++)
                {
                    const x = a[i] || 0,
                        y = b[i] || 0;
                    if (x > y) return true;
                    if (x < y) return false;
                }
                return false;
            }

            function getVersionFromMeta(metaStr)
            {
                const m = /@version\s+([0-9.]+)/i.exec(metaStr || "");
                return m ? m[1] : null;
            }

            function gmFetch(url)
            {
                return new Promise((resolve, reject) =>
                {
                    GM_xmlhttpRequest(
                    {
                        method: "GET",
                        url,
                        headers:
                        {
                            "Accept": "text/plain; charset=utf-8"
                        },
                        onload: res => res.status === 200 ? resolve(res.responseText) : reject(new Error("HTTP " + res.status)),
                        onerror: e => reject(e)
                    });
                });
            }

            // --- robust README parser (exact section + date) ---
            function extractReleaseNotes(mdText, version)
            {
                try
                {
                    let txt = String(mdText || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

                    // Work line-by-line to get clean boundaries
                    const lines = txt.split("\n");

                    // Match headings like "##/###/#### Version 3.5.2.4"
                    const escVer = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const thisHdr = new RegExp("^\\s{0,3}#{2,6}\\s*Version\\s*" + escVer + "\\b.*$", "i");
                    const anyHdr = /^\s{0,3}#{2,6}\s*Version\s*\d[\d.]*/i;

                    // Find start of the requested version, else fall back to first "Version ..." section
                    let start = lines.findIndex(l => thisHdr.test(l));
                    if (start === -1) start = lines.findIndex(l => anyHdr.test(l));
                    if (start === -1) return "";

                    // Find end at next "Version ..." heading
                    let end = lines.slice(start + 1).findIndex(l => anyHdr.test(l));
                    if (end !== -1) end = start + 1 + end;
                    else end = lines.length;

                    // Content between headings
                    const block = lines.slice(start + 1, end).map(l => l.trim());

                    // First non-empty, non-bullet line is treated as the date line
                    const dateLine = block.find(l => l && !/^[-*]\s+/.test(l));
                    const bullets = block.filter(l => /^[-*]\s+/.test(l)).map(l => l.replace(/^[-*]\s+/, ""));

                    // Build HTML (include date if present)
                    let html = "";
                    if (dateLine) html += `<div class="ct-date">${escHtml(dateLine)}</div>`;
                    if (bullets.length)
                    {
                        html += "<ul>" + bullets.map(li => "<li>" + escHtml(li) + "</li>").join("") + "</ul>";
                    }
                    else
                    {
                        // Fallback: show up to 6 lines of plain text if there are no bullet points
                        const snippet = block.filter(Boolean).slice(dateLine ? 1 : 0, 6).join("\n");
                        if (snippet) html += "<pre style='white-space:pre-wrap;margin:0'>" + escHtml(snippet) + "</pre>";
                    }
                    return html;
                }
                catch (e)
                {
                    console.warn("[Cachetur/update] extractReleaseNotes failed:", e);
                    return "";
                }
            }

            function ensureToastCss()
            {
                if (window.__ctToastCss) return;
                window.__ctToastCss = true;
                GM_addStyle(`
          .ct-toast { position:fixed; right:16px; bottom:16px; z-index:999999;
            max-width:420px; padding:14px 14px 12px; border-radius:10px;
            background:#1f2937; color:#e5e7eb; box-shadow:0 10px 30px rgba(0,0,0,.35);
            font:14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
          .ct-toast h4{ margin:0 0 6px; font-size:16px; color:#fff; }
          .ct-toast p{ margin:0 0 8px; color:#cbd5e1; }
          .ct-toast ul{ margin:6px 0 10px 18px; padding:0; }
          .ct-toast li{ margin:4px 0; }
          .ct-toast .ct-date { font-size:12px; color:#9ca3af; margin:2px 0 6px; }
          .ct-toast .ct-actions{ display:flex; gap:8px; margin-top:10px; }
          .ct-toast button{ border:0; border-radius:8px; padding:8px 12px; cursor:pointer;
            background:#10b981; color:#001; font-weight:600; }
          .ct-toast button.ct-secondary{ background:#374151; color:#e5e7eb; }
          .ct-toast .ct-close{ position:absolute; right:10px; top:8px; cursor:pointer; color:#9ca3af; }
          @media (max-width:600px){ .ct-toast{ left:16px; right:16px; } }
        `);
            }

            function showUpdateToast(version, htmlNotes, downloadUrl, onLater, onUpdate)
            {
                ensureToastCss();
                const wrap = document.createElement("div");
                wrap.className = "ct-toast";
                wrap.innerHTML =
                    `<div class="ct-close" aria-label="Close">✕</div>
           <h4>The Cachetur Assistant ${escHtml(version)} is available</h4>
           <p><strong>What's new</strong></p>
           <div class="ct-notes">${htmlNotes || "<em>(No notes)</em>"}</div>
           <div class="ct-actions">
             <button class="ct-update">Update</button>
             <button class="ct-secondary ct-later">Later</button>
           </div>`;
                document.body.appendChild(wrap);

                const close = () => wrap.remove();
                wrap.querySelector(".ct-later").onclick = () =>
                {
                    onLater && onLater();
                    close();
                };
                wrap.querySelector(".ct-close").onclick = () =>
                {
                    onLater && onLater();
                    close();
                }; // treat X as Later
                wrap.querySelector(".ct-update").onclick = () =>
                {
                    onUpdate && onUpdate();
                    GM_openInTab(downloadUrl,
                    {
                        active: true
                    });
                    close();
                };
            }

            function getLastNotified()
            {
                const v = GM_getValue(LAST_NOTIFIED_KEY, null);
                if (typeof v === "string") return {
                    version: v,
                    at: 0
                }; // migration from old format
                if (v && typeof v === "object" && v.version) return v;
                return null;
            }

            async function checkForUpdates()
            {
                try
                {
                    const updateURL = GM_info.script.updateURL;
                    const downloadURL = GM_info.script.downloadURL;
                    const current = GM_info.script.version;
                    console.log(`[Cachetur/update] Checking… current=${current}`);
                    if (!updateURL)
                    {
                        console.warn("[Cachetur/update] No updateURL in metadata");
                        return;
                    }

                    const meta = await gmFetch(updateURL);
                    const latest = getVersionFromMeta(meta);
                    console.log(`[Cachetur/update] Latest in meta: ${latest}`);
                    if (!latest || !isNewerVersion(latest, current)) return;

                    // Snooze logic: don't nag again within REMIND_AFTER_MS for the same version
                    const last = getLastNotified();
                    if (last && last.version === latest && (Date.now() - last.at) < REMIND_AFTER_MS)
                    {
                        const left = Math.ceil((REMIND_AFTER_MS - (Date.now() - last.at)) / (60 * 60 * 1000));
                        console.debug(`[Cachetur/update] Snoozed ${latest}, ~${left}h left`);
                        return;
                    }

                    let notesHtml = "";
                    try
                    {
                        const readme = await gmFetch(README_RAW_URL);
                        notesHtml = extractReleaseNotes(readme, latest);
                        if (!notesHtml) console.debug("[Cachetur/update] README fetched but notes parsed empty");
                    }
                    catch (e)
                    {
                        console.warn("[Cachetur/update] README fetch failed:", e);
                    }

                    const snooze = () => GM_setValue(LAST_NOTIFIED_KEY,
                    {
                        version: latest,
                        at: Date.now()
                    });
                    const silenceNow = () => GM_setValue(LAST_NOTIFIED_KEY,
                    {
                        version: latest,
                        at: Date.now()
                    });

                    try
                    {
                        showUpdateToast(latest, notesHtml, downloadURL, snooze, silenceNow);
                    }
                    catch (e)
                    {
                        console.warn("[Cachetur/update] Toast failed, fallback to confirm():", e);
                        if (confirm(`A new version (${latest}) of The Cachetur Assistant is available.\nDo you want to update now?`))
                        {
                            GM_openInTab(downloadURL,
                            {
                                active: true
                            });
                            silenceNow();
                        }
                        else
                        {
                            snooze();
                        }
                    }
                }
                catch (err)
                {
                    console.warn("[Cachetur/update] Update check failed:", err);
                }
            }

            // small delay so <body> exists; then poll hourly
            setTimeout(checkForUpdates, 2000);
            setInterval(checkForUpdates, CHECK_INTERVAL);
        })();
        /// End of version check/update

        // ---- Cachetur POI overlay (Overpass) ----
    /* [TCA2] extracted createCT_POI */
     // end createCT_POI()

        // ---- Fill Menu (fully i18n'ed labels, defaults OFF, data untouched)
        function ctStartmenu()
        {
            // i18n helper
            const tt = (key) =>
            {
                try
                {
                    return (typeof i18next !== "undefined" && i18next.t) ? i18next.t(key) : key;
                }
                catch
                {
                    return key;
                }
            };

            // Fallback if GM_config is unavailable: register a minimal menu and log why
            if (typeof GM_config === "undefined")
            {
                console.log("[CT_MENU] Could not load GM_config! Using default settings for now.", 1, "error");
                GM_registerMenuCommand(`⚙️ ${tt("menu.configure")}`, () =>
                {
                    console.log("[CT_MENU] Could not load GM_config! External resource may be temporarily down.");
                });
                return;
            }

            // Push current selections into CT_POI (and retry until map is ready if asked)
            function applyPoiFromConfig(opts = {
                waitForMap: true
            })
            {
                const enable = GM_config.get("poi_enable");
                const poiOpts = {
                    parking: GM_config.get("poi_parking"),
                    lodging: GM_config.get("poi_lodging"),
                    food: GM_config.get("poi_food"),
                    rest: GM_config.get("poi_rest"),
                    attraction: GM_config.get("poi_attraction"),
                    store: GM_config.get("poi_store"),
                    terminal: GM_config.get("poi_terminal"),
                    fuel: GM_config.get("poi_fuel"),
                    ev: GM_config.get("poi_ev"),
                    rv: GM_config.get("poi_rv"),
                    wildcamp: GM_config.get("poi_wildcamp")
                };

                // Clustering
                const clusterEnable = GM_config.get("poi_cluster");
                const clusterDisableAtZoom = parseInt(GM_config.get("poi_cluster_disable_at_zoom"), 10) || 15;

                // Advanced filters (values are booleans/strings as-is)
                const adv = {
                    ev:
                    {
                        sockets:
                        {
                            // EU / International
                            type2: GM_config.get("ev_socket_type2"),
                            ccs: GM_config.get("ev_socket_ccs"),
                            chademo: GM_config.get("ev_socket_chademo"),
                            schuko: GM_config.get("ev_socket_schuko"),
                            // North America
                            type1: GM_config.get("ev_socket_type1"),
                            j1772: GM_config.get("ev_socket_type1"), // alias
                            ccs1: GM_config.get("ev_socket_ccs1"),
                            nacs: GM_config.get("ev_socket_nacs"),
                            // Tesla legacy tags in OSM
                            tesla_sc: GM_config.get("ev_socket_tesla_sc"),
                            tesla_dest: GM_config.get("ev_socket_tesla_dest"),
                            // NEMA / RV
                            nema1450: GM_config.get("ev_socket_nema1450"),
                            nema515: GM_config.get("ev_socket_nema515"),
                            nema520: GM_config.get("ev_socket_nema520"),
                            tt30: GM_config.get("ev_socket_tt30")
                        },
                        minKW: Number(GM_config.get("ev_min_kw") || 0)
                    },

                    lodging:
                    {
                        types:
                        {
                            hotel: GM_config.get("lod_hotel"),
                            motel: GM_config.get("lod_motel"),
                            guest_house: GM_config.get("lod_guest_house"),
                            hostel: GM_config.get("lod_hostel"),
                            alpine_hut: GM_config.get("lod_alpine_hut"),
                            camp_site: GM_config.get("lod_camp_site"),
                            caravan_site: GM_config.get("lod_caravan_site"),
                            chalet: GM_config.get("lod_chalet")
                        },
                        amenities:
                        {
                            showers: GM_config.get("lod_shower"),
                            toilets: GM_config.get("lod_toilets"),
                            drinking: GM_config.get("lod_drinking_water"),
                            wifi: GM_config.get("lod_wifi"),
                            reservation: GM_config.get("lod_reservation"),
                            price_free: GM_config.get("lod_free_only")
                        }
                    },

                    attraction:
                    {
                        culture:
                        {
                            museum: GM_config.get("att_c_museum"),
                            artwork: GM_config.get("att_c_artwork"),
                            castle: GM_config.get("att_c_castle"),
                            ruins: GM_config.get("att_c_ruins"),
                            monument: GM_config.get("att_c_monument"),
                            memorial: GM_config.get("att_c_memorial"),
                            archaeological_site: GM_config.get("att_c_archaeo"),
                            church: GM_config.get("att_c_church")
                        },
                        nature:
                        {
                            viewpoint: GM_config.get("att_n_viewpoint"),
                            picnic_site: GM_config.get("att_n_picnic"),
                            peak: GM_config.get("att_n_peak"),
                            volcano: GM_config.get("att_n_volcano"),
                            waterfall: GM_config.get("att_n_waterfall"),
                            cave_entrance: GM_config.get("att_n_cave")
                        },
                        recreation:
                        {
                            theme_park: GM_config.get("att_r_themepark"),
                            zoo: GM_config.get("att_r_zoo"),
                            aquarium: GM_config.get("att_r_aquarium"),
                            gallery: GM_config.get("att_r_gallery"),
                            planetarium: GM_config.get("att_r_planetarium"),
                            roller_coaster: GM_config.get("att_r_coaster")
                        }
                    },

                    parking:
                    {
                        free_only: GM_config.get("pk_free_only"),
                        covered_only: GM_config.get("pk_covered_only"),
                        paved_only: GM_config.get("pk_paved_only"),
                        pnr_only: GM_config.get("pk_pnr_only"),
                        min_capacity: parseInt(GM_config.get("pk_min_capacity") || "0", 10) || 0,
                        motorhome_ok: GM_config.get("pk_motorhome_ok"),
                        disabled_only: GM_config.get("pk_disabled_only"),
                        maxheight_limit: parseFloat(GM_config.get("pk_maxheight") || "0") || 0
                        // (lit_only / supervised_only / public_only / types / toilets / drinking / ev_ok)
                        // har defaults i CT_POI og kan evt. legges til i UI senere
                    },

                    // Rest/fuel/terminal/rv/wildcamp sendes også videre; CT_POI ignorerer ukjente felter trygt.
                    rest:
                    {
                        toilets: GM_config.get("rest_toilets"),
                        drinking: GM_config.get("rest_drinking"),
                        shelter: GM_config.get("rest_shelter"),
                        picnic_table: GM_config.get("rest_picnic"),
                        overnight_ok: GM_config.get("rest_overnight"),
                        hgv_capacity: GM_config.get("rest_hgv_cap_only")
                    },

                    fuel:
                    {
                        types:
                        {
                            diesel: GM_config.get("fu_diesel"),
                            petrol: GM_config.get("fu_petrol"),
                            e10: GM_config.get("fu_e10"),
                            e85: GM_config.get("fu_e85"),
                            lpg: GM_config.get("fu_lpg"),
                            cng: GM_config.get("fu_cng")
                        },
                        open_247: GM_config.get("fu_open_247"),
                        brand: (GM_config.get("fu_brand") || "").trim()
                    },

                    food:
                    {
                        kinds:
                        {
                            restaurant: GM_config.get("fd_restaurant"),
                            fast_food: GM_config.get("fd_fastfood"),
                            cafe: GM_config.get("fd_cafe"),
                            pub_bar: GM_config.get("fd_pubbar")
                        },
                        diet:
                        {
                            vegan: GM_config.get("fd_vegan"),
                            vegetarian: GM_config.get("fd_vegetarian")
                        }
                    },

                    // >>> STORE – expanded subfilters <<<
                    store:
                    {
                        kinds:
                        {
                            supermarket: GM_config.get("st_supermarket"),
                            convenience: GM_config.get("st_convenience"),
                            bakery: GM_config.get("st_bakery"),
                            pharmacy: GM_config.get("st_pharmacy"),
                            medical_supply: GM_config.get("st_medical_supply"),
                            hardware: GM_config.get("st_hardware"),
                            doityourself: GM_config.get("st_hardware"), // optional alias
                            outdoor: GM_config.get("st_outdoor"),
                            sports: GM_config.get("st_sports"),
                            camping: GM_config.get("st_camping"),
                            clothes: GM_config.get("st_clothes"),
                            shoes: GM_config.get("st_shoes"),
                            bicycle: GM_config.get("st_bicycle"),
                            car_repair: GM_config.get("st_car_repair"),
                            car_parts: GM_config.get("st_car_parts"),
                            motorcycle: GM_config.get("st_motorcycle"),
                            electronics: GM_config.get("st_electronics"),
                            mobile_phone: GM_config.get("st_mobile_phone"),
                            computer: GM_config.get("st_computer"),
                            laundry: GM_config.get("st_laundry"),
                            dry_cleaning: GM_config.get("st_dry_cleaning")
                        },
                        brand: (GM_config.get("st_brand") || "").trim()
                    },

                    terminal:
                    {
                        modes:
                        {
                            rail: GM_config.get("tm_rail"),
                            bus: GM_config.get("tm_bus"),
                            ferry: GM_config.get("tm_ferry"),
                            airport: GM_config.get("tm_airport"),
                            platform: GM_config.get("tm_platform")
                        },
                        wheelchair: GM_config.get("tm_wheelchair")
                    },

                    rv:
                    {
                        sanitary_dump: GM_config.get("rv_dump"),
                        water_point: GM_config.get("rv_water"),
                        electricity: GM_config.get("rv_power"),
                        showers: GM_config.get("rv_showers"),
                        toilets: GM_config.get("rv_toilets"),
                        free_only: GM_config.get("rv_free_only")
                    },

                    wildcamp:
                    {
                        allow_informal: GM_config.get("wc_allow_informal"),
                        only_basic: GM_config.get("wc_only_basic")
                    }
                };

                console.log("[CT_POI/apply]",
                {
                    enable,
                    poiOpts,
                    clusterEnable,
                    clusterDisableAtZoom,
                    adv
                });

                function startOrRetry()
                {
                    if (!enable)
                    {
                        try
                        {
                            if (typeof CT_POI?.destroy === "function") CT_POI.destroy();
                        }
                        catch
                        {}
                        return;
                    }
                    if (!CT_POI?.init)
                    {
                        console.warn("[CT_POI/apply] CT_POI module not available.");
                        return;
                    }

                    if (CT_POI.setClusterOptions)
                    {
                        CT_POI.setClusterOptions(
                        {
                            enable: clusterEnable,
                            disableAtZoom: clusterDisableAtZoom
                        });
                    }
                    if (CT_POI.setAdvFilters)
                    {
                        CT_POI.setAdvFilters(adv); // CT_POI vil ignorere ikke-støttede nøkler trygt
                    }

                    const ok = CT_POI.init(poiOpts);
                    if (!ok && opts.waitForMap) return void setTimeout(startOrRetry, 400);
                    if (ok && CT_POI.updateEnabled) CT_POI.updateEnabled(poiOpts);
                }
                startOrRetry();
            }

     // GM_config fields
    // NOTE: Labels updated to use text-variant emojis (U+FE0E) for darker glyphs.
    //       Parking keeps 🅿️ (emoji-style) for recognisable blue P.
    GM_config.init({
      id: "MyConfig",
      title: `${tt("edit.assistant")} ${tt("edit.settings")}<br>`,

      // Button texts + tooltips (the lib reads these directly)
      labels: {
        save:       tt("buttons.save"),
        saveTitle:  tt("buttons.save") || tt("buttons.save"),
        close:      tt("buttons.close"),
        closeTitle: tt("buttons.close"),
        reset:      tt("buttons.reset"),
        resetTitle: tt("buttons.reset_to_defaults") || tt("buttons.reset")
      },

      fields: {
        // Core toggles
        uc1: {
          label: `<b>${tt("edit.toggle")}</b><br><i class="small">${tt("edit.default")} ${tt("edit.off")}</i>`,
          type: "checkbox",
          default: false
        },
        uc2: {
          label: `<b>${tt("edit.open")}</b><br>${tt("edit.warning")}<br><i class="small">${tt("edit.default")} ${tt("edit.off")}</i>`,
          type: "checkbox",
          default: false
        },
        uc3: {
          label: `<b>${tt("edit.dt")}</b><br><i class="small">${tt("edit.default")} ${tt("edit.off")}</i>`,
          type: "checkbox",
          default: false
        },

        // POI master switch
        poi_enable: {
          label: `<b>${tt("edit.poi_overlay")}</b> — ${tt("edit.poi_overlay_desc")}`,
          type: "checkbox",
          default: false
        },

        // Categories
        poi_parking:  { label: `🅿️ ${tt("edit.cat.parking")}`, type: "checkbox", default: false }, // keep emoji-style
        poi_lodging:  { label: `🛏︎ ${tt("edit.cat.lodging")}`, type: "checkbox", default: false },
        poi_food:     { label: `🍽︎ ${tt("edit.cat.food")}`,    type: "checkbox", default: false },
        poi_rest:     { label: `🪑︎ ${tt("edit.cat.rest")}`,    type: "checkbox", default: false },
        poi_attraction:{label: `⌘ ${tt("edit.cat.attraction")}`,type: "checkbox", default: false },
        poi_store:    { label: `🛒︎ ${tt("edit.cat.store")}`,   type: "checkbox", default: false },
        poi_terminal: { label: `🚉︎ ${tt("edit.cat.terminal")}`,type: "checkbox", default: false },
        poi_fuel:     { label: `⛽︎ ${tt("edit.cat.fuel")}`,    type: "checkbox", default: false },
        poi_ev:       { label: `🔌︎ ${tt("edit.cat.ev")}`,      type: "checkbox", default: false },
        poi_rv:       { label: `🚐︎ ${tt("edit.cat.rv")}`,      type: "checkbox", default: false },
        poi_wildcamp: { label: `⛺︎ ${tt("edit.cat.wildcamp")}`,type: "checkbox", default: false },

        // Clustering
        cluster_hdr: {
          label: `<hr><b>${tt("edit.cluster.title")}</b>`,
          type: "hidden",
          default: ""
        },
        poi_cluster: {
          label: tt("edit.cluster.enable"),
          type: "checkbox",
          default: false
        },
        poi_cluster_disable_at_zoom: {
          label: tt("edit.cluster.disable_at_zoom"),
          type: "int",
          default: 15
        },

        // EV filters
        ev_hdr: { label: `<hr><b>${tt("edit.panel.ev_filters")}</b>`, type: "hidden", default: "" },
        ev_socket_type2:  { label: tt("edit.ev.allow_type2"),  type: "checkbox", default: false },
        ev_socket_ccs:    { label: tt("edit.ev.allow_ccs2"),   type: "checkbox", default: false },
        ev_socket_chademo:{ label: tt("edit.ev.allow_chademo"),type: "checkbox", default: false },
        ev_socket_schuko: { label: tt("edit.ev.allow_schuko"), type: "checkbox", default: false },
        ev_socket_type1:  { label: tt("edit.ev.allow_type1"),  type: "checkbox", default: false },
        ev_socket_ccs1:   { label: tt("edit.ev.allow_ccs1"),   type: "checkbox", default: false },
        ev_socket_nacs:   { label: tt("edit.ev.allow_nacs"),   type: "checkbox", default: false },
        ev_socket_tesla_sc:{label: tt("edit.ev.allow_tesla_sc"),type: "checkbox", default: false },
        ev_socket_tesla_dest:{label: tt("edit.ev.allow_tesla_dest"), type: "checkbox", default: false },
        ev_socket_nema1450:{ label: tt("edit.ev.allow_nema1450"), type: "checkbox", default: false },
        ev_socket_nema515:{ label: tt("edit.ev.allow_nema515"), type: "checkbox", default: false },
        ev_socket_nema520:{ label: tt("edit.ev.allow_nema520"), type: "checkbox", default: false },
        ev_socket_tt30:   { label: tt("edit.ev.allow_tt30"),   type: "checkbox", default: false },
        ev_min_kw:        { label: tt("edit.ev.min_kw"),       type: "int",      default: 0 },

        // Lodging
        lod_hdr: { label: `<hr><b>${tt("edit.panel.lodging")}</b>`, type: "hidden", default: "" },
        lod_hotel:        { label: tt("edit.lodging.types.hotel"),        type: "checkbox", default: false },
        lod_motel:        { label: tt("edit.lodging.types.motel"),        type: "checkbox", default: false },
        lod_guest_house:  { label: tt("edit.lodging.types.guest_house"),  type: "checkbox", default: false },
        lod_hostel:       { label: tt("edit.lodging.types.hostel"),       type: "checkbox", default: false },
        lod_alpine_hut:   { label: tt("edit.lodging.types.alpine_hut"),   type: "checkbox", default: false },
        lod_camp_site:    { label: tt("edit.lodging.types.camp_site"),    type: "checkbox", default: false },
        lod_caravan_site: { label: tt("edit.lodging.types.caravan_site"), type: "checkbox", default: false },
        lod_chalet:       { label: tt("edit.lodging.types.chalet"),       type: "checkbox", default: false },
        lod_shower:       { label: tt("edit.lodging.amenities.require_showers"),        type: "checkbox", default: false },
        lod_toilets:      { label: tt("edit.lodging.amenities.require_toilets"),        type: "checkbox", default: false },
        lod_drinking_water:{label: tt("edit.lodging.amenities.require_drinking_water"), type: "checkbox", default: false },
        lod_wifi:         { label: tt("edit.lodging.amenities.require_wifi"),           type: "checkbox", default: false },
        lod_reservation:  { label: tt("edit.lodging.amenities.reservation_only"),      type: "checkbox", default: false },
        lod_free_only:    { label: tt("edit.lodging.amenities.free_only"),             type: "checkbox", default: false },

        // Attraction
        att_hdr: { label: `<hr><b>${tt("edit.panel.attraction")}</b>`, type: "hidden", default: "" },
        att_c_museum:   { label: tt("edit.attraction_labels.museum"),    type: "checkbox", default: false },
        att_c_artwork:  { label: tt("edit.attraction_labels.artwork"),   type: "checkbox", default: false },
        att_c_castle:   { label: tt("edit.attraction_labels.castle"),    type: "checkbox", default: false },
        att_c_ruins:    { label: tt("edit.attraction_labels.ruins"),     type: "checkbox", default: false },
        att_c_monument: { label: tt("edit.attraction_labels.monument"),  type: "checkbox", default: false },
        att_c_memorial: { label: tt("edit.attraction_labels.memorial"),  type: "checkbox", default: false },
        att_c_archaeo:  { label: tt("edit.attraction_labels.archaeo"),   type: "checkbox", default: false },
        att_c_church:   { label: tt("edit.attraction_labels.church"),    type: "checkbox", default: false },
        att_n_viewpoint:{ label: tt("edit.attraction_labels.viewpoint"), type: "checkbox", default: false },
        att_n_picnic:   { label: tt("edit.attraction_labels.picnic"),    type: "checkbox", default: false },
        att_n_peak:     { label: tt("edit.attraction_labels.peak"),      type: "checkbox", default: false },
        att_n_volcano:  { label: tt("edit.attraction_labels.volcano"),   type: "checkbox", default: false },
        att_n_waterfall:{ label: tt("edit.attraction_labels.waterfall"), type: "checkbox", default: false },
        att_n_cave:     { label: tt("edit.attraction_labels.cave"),      type: "checkbox", default: false },
        att_r_themepark:{ label: tt("edit.attraction_labels.themepark"), type: "checkbox", default: false },
        att_r_zoo:      { label: tt("edit.attraction_labels.zoo"),       type: "checkbox", default: false },
        att_r_aquarium: { label: tt("edit.attraction_labels.aquarium"),  type: "checkbox", default: false },
        att_r_gallery:  { label: tt("edit.attraction_labels.gallery"),   type: "checkbox", default: false },
        att_r_planetarium:{label: tt("edit.attraction_labels.planetarium"), type: "checkbox", default: false },
        att_r_coaster:  { label: tt("edit.attraction_labels.coaster"),   type: "checkbox", default: false },

        // Parking
        pk_hdr: { label: `<hr><b>${tt("edit.panel.parking")}</b>`, type: "hidden", default: "" },
        pk_free_only:   { label: tt("edit.parking.free_only"),  type: "checkbox", default: false },
        pk_covered_only:{ label: tt("edit.parking.covered_only"),type: "checkbox", default: false },
        pk_paved_only:  { label: tt("edit.parking.paved_only"), type: "checkbox", default: false },
        pk_pnr_only:    { label: tt("edit.parking.pnr_only"),   type: "checkbox", default: false },
        pk_motorhome_ok:{ label: tt("edit.parking.motorhome_ok"), type: "checkbox", default: false },
        pk_min_capacity:{ label: tt("edit.parking.min_capacity"), type: "int", default: 0 },
        pk_disabled_only:{label: "♿︎ " + tt("edit.parking.disabled_only"), type: "checkbox", default: false },
        pk_maxheight:   { label: tt("edit.parking.max_height"), type: "float", default: 0 },

        // Rest
        rest_hdr: { label: `<hr><b>${tt("edit.panel.rest")}</b>`, type: "hidden", default: "" },
        rest_toilets:   { label: tt("edit.rest.require_toilets"), type: "checkbox", default: false },
        rest_drinking:  { label: tt("edit.rest.require_drinking"),type: "checkbox", default: false },
        rest_shelter:   { label: tt("edit.rest.require_shelter"), type: "checkbox", default: false },
        rest_picnic:    { label: tt("edit.rest.require_picnic"),  type: "checkbox", default: false },
        rest_overnight: { label: tt("edit.rest.overnight_hint"),  type: "checkbox", default: false },
        rest_hgv_cap_only:{ label: tt("edit.rest.hgv_cap_only"),  type: "checkbox", default: false },

        // Fuel
        fu_hdr: { label: `<hr><b>${tt("edit.panel.fuel")}</b>`, type: "hidden", default: "" },
        fu_diesel:   { label: tt("edit.fuel.diesel"), type: "checkbox", default: false },
        fu_petrol:   { label: tt("edit.fuel.petrol"), type: "checkbox", default: false },
        fu_e10:      { label: tt("edit.fuel.e10"),    type: "checkbox", default: false },
        fu_e85:      { label: tt("edit.fuel.e85"),    type: "checkbox", default: false },
        fu_lpg:      { label: tt("edit.fuel.lpg"),    type: "checkbox", default: false },
        fu_cng:      { label: tt("edit.fuel.cng"),    type: "checkbox", default: false },
        fu_open_247: { label: tt("edit.fuel.open_247"), type: "checkbox", default: false },
        fu_brand:    { label: tt("edit.fuel.brand_contains"), type: "text", default: "" },

        // Food
        fd_hdr: { label: `<hr><b>${tt("edit.panel.food")}</b>`, type: "hidden", default: "" },
        fd_restaurant: { label: tt("edit.food.restaurant"),  type: "checkbox", default: false },
        fd_fastfood:   { label: tt("edit.food.fastfood"),    type: "checkbox", default: false },
        fd_cafe:       { label: tt("edit.food.cafe"),        type: "checkbox", default: false },
        fd_pubbar:     { label: tt("edit.food.pubbar"),      type: "checkbox", default: false },
        fd_vegan:      { label: tt("edit.food.vegan_only"),  type: "checkbox", default: false },
        fd_vegetarian: { label: tt("edit.food.vegetarian_only"), type: "checkbox", default: false },

        // Store
        st_hdr: { label: `<hr><b>${tt("edit.panel.store")}</b>`, type: "hidden", default: "" },
        st_supermarket:   { label: tt("edit.store.supermarket"),    type: "checkbox", default: false },
        st_convenience:   { label: tt("edit.store.convenience"),    type: "checkbox", default: false },
        st_bakery:        { label: tt("edit.store.bakery"),         type: "checkbox", default: false },
        st_pharmacy:      { label: tt("edit.store.pharmacy"),       type: "checkbox", default: false },
        st_medical_supply:{ label: tt("edit.store.medical_supply"), type: "checkbox", default: false },
        st_hardware:      { label: tt("edit.store.hardware"),       type: "checkbox", default: false },
        st_outdoor:       { label: tt("edit.store.outdoor"),        type: "checkbox", default: false },
        st_sports:        { label: tt("edit.store.sports"),         type: "checkbox", default: false },
        st_camping:       { label: tt("edit.store.camping"),        type: "checkbox", default: false },
        st_clothes:       { label: tt("edit.store.clothes"),        type: "checkbox", default: false },
        st_shoes:         { label: tt("edit.store.shoes"),          type: "checkbox", default: false },
        st_bicycle:       { label: tt("edit.store.bicycle"),        type: "checkbox", default: false },
        st_car_repair:    { label: tt("edit.store.car_repair"),     type: "checkbox", default: false },
        st_car_parts:     { label: tt("edit.store.car_parts"),      type: "checkbox", default: false },
        st_motorcycle:    { label: tt("edit.store.motorcycle"),     type: "checkbox", default: false },
        st_electronics:   { label: tt("edit.store.electronics"),    type: "checkbox", default: false },
        st_mobile_phone:  { label: tt("edit.store.mobile_phone"),   type: "checkbox", default: false },
        st_computer:      { label: tt("edit.store.computer"),       type: "checkbox", default: false },
        st_laundry:       { label: tt("edit.store.laundry"),        type: "checkbox", default: false },
        st_dry_cleaning:  { label: tt("edit.store.dry_cleaning"),   type: "checkbox", default: false },
        st_brand:         { label: tt("edit.store.brand_contains"), type: "text",     default: "" },

        // Terminal
        tm_hdr: { label: `<hr><b>${tt("edit.panel.terminal")}</b>`, type: "hidden", default: "" },
        tm_rail:       { label: tt("edit.terminal.rail"),       type: "checkbox", default: false },
        tm_bus:        { label: tt("edit.terminal.bus"),        type: "checkbox", default: false },
        tm_ferry:      { label: tt("edit.terminal.ferry"),      type: "checkbox", default: false },
        tm_airport:    { label: tt("edit.terminal.airport"),    type: "checkbox", default: false },
        tm_platform:   { label: tt("edit.terminal.platform"),   type: "checkbox", default: false },
        tm_wheelchair: { label: tt("edit.terminal.wheelchair_only"), type: "checkbox", default: false },

        // RV
        rv_hdr: { label: `<hr><b>${tt("edit.panel.rv")}</b>`, type: "hidden", default: "" },
        rv_dump:      { label: tt("edit.rv.dump"),    type: "checkbox", default: false },
        rv_water:     { label: tt("edit.rv.water"),   type: "checkbox", default: false },
        rv_power:     { label: tt("edit.rv.power"),   type: "checkbox", default: false },
        rv_showers:   { label: tt("edit.rv.showers"), type: "checkbox", default: false },
        rv_toilets:   { label: tt("edit.rv.toilets"), type: "checkbox", default: false },
        rv_free_only: { label: tt("edit.rv.free_only"), type: "checkbox", default: false },

        // Wildcamp
        wc_hdr: { label: `<hr><b>${tt("edit.panel.wildcamp")}</b>`, type: "hidden", default: "" },
        wc_allow_informal: { label: tt("edit.wildcamp.allow_informal"), type: "checkbox", default: false },
        wc_only_basic:     { label: tt("edit.wildcamp.only_basic"),     type: "checkbox", default: false }
      }
    });


            // Menu command
            GM_registerMenuCommand(`⚙️ ${tt("menu.configure")}`, () => GM_config.open(), "C");

            // Extra toggles
            const uc1 = GM_config.get("uc1");
            const uc2 = GM_config.get("uc2");
            const uc3 = GM_config.get("uc3");
            if (uc1 && typeof updatecoord === "function") updatecoord();
            if (uc2 && typeof open_new_page === "function") open_new_page();
            if (uc3 && typeof $ !== "undefined")
            {
                const existCondition = setInterval(function ()
                {
                    if ($("#cachetur-tur-valg").length)
                    {
                        clearInterval(existCondition);
                        if (typeof tvinfo === "function") tvinfo();
                    }
                }, 100);
            }

            GM_config.onSave = function ()
            {
                applyPoiFromConfig(
                {
                    waitForMap: true
                });
            };
            GM_config.onClose = function ()
            {
                applyPoiFromConfig(
                {
                    waitForMap: true
                });
            };

            if (GM_config.get("poi_enable")) applyPoiFromConfig(
            {
                waitForMap: true
            });

            // Dialog layout (group fields, only UI)
            GM_config.onOpen = function ()
            {
                const cfgId = GM_config.id || "MyConfig";
                const doc = GM_config.frame ? GM_config.frame.contentDocument : document;

                const row = (key) =>
                    doc.getElementById(`${cfgId}_${key}_container`) ||
                    (doc.getElementById(`${cfgId}_field_${key}`) && doc.getElementById(`${cfgId}_field_${key}`).closest(".config_var")) ||
                    (doc.getElementById(`${cfgId}_field_${key}`) && doc.getElementById(`${cfgId}_field_${key}`).closest("tr"));

                const style = doc.createElement("style");
                style.textContent = `
          .ct-cat-grid { display:grid; grid-template-columns:repeat(4, minmax(180px,1fr)); gap:6px 16px; align-items:center; }
          .ct-cat-grid .config_var { margin:0; }
          .ct-bottom-panels { margin-top:10px; padding-top:10px; border-top:1px solid #bbb; }
          details.ct-sub { margin:8px 0 12px 0; }
          details.ct-sub > summary { cursor:pointer; font-weight:600; }
          .ct-subhead { font-weight:600; margin:8px 0 4px; }
          .ct-col-2 { display:grid; grid-template-columns:repeat(2, minmax(240px, 1fr)); gap:6px 16px; }
          .ct-col-3 { display:grid; grid-template-columns:repeat(3, minmax(200px, 1fr)); gap:6px 16px; }
          .ct-hidden { display:none !important; }
        `;
                doc.head.appendChild(style);

                // 4-column grid for category toggles
                const catKeys = [
                    "poi_parking", "poi_lodging", "poi_food", "poi_rest",
                    "poi_attraction", "poi_store", "poi_terminal", "poi_fuel",
                    "poi_ev", "poi_rv", "poi_wildcamp"
                ];
                const enableRow = row("poi_enable");
                if (enableRow)
                {
                    const grid = doc.createElement("div");
                    grid.className = "ct-cat-grid";
                    enableRow.insertAdjacentElement("afterend", grid);
                    catKeys.forEach(k =>
                    {
                        const r = row(k);
                        if (r) grid.appendChild(r);
                    });
                }

                const anchor = row("poi_cluster_disable_at_zoom") || row("poi_cluster") || row("cluster_hdr") || enableRow;
                let bottom = doc.querySelector(".ct-bottom-panels");
                if (!bottom)
                {
                    bottom = doc.createElement("div");
                    bottom.className = "ct-bottom-panels";
                    (anchor || doc.body).insertAdjacentElement("afterend", bottom);
                }

                const linkVisibility = (detailsEl, masterKey) =>
                {
                    const cb = doc.getElementById(`${cfgId}_field_${masterKey}`);
                    const sync = () =>
                    {
                        detailsEl.classList.toggle("ct-hidden", !(cb && cb.checked));
                        syncBottomVisibility();
                    };
                    if (cb) cb.addEventListener("change", sync);
                    sync();
                };
                const makeDetails = (titleKey) =>
                {
                    const d = doc.createElement("details");
                    d.className = "ct-sub";
                    d.open = false;
                    d.innerHTML = `<summary>${tt(titleKey)} ▸ ${tt("edit.showhide")}</summary>`;
                    const body = doc.createElement("div");
                    d.appendChild(body);
                    return {
                        d,
                        body
                    };
                };
                const appendKeys = (container, keys) =>
                {
                    keys.forEach(k =>
                    {
                        const r = row(k);
                        if (r) container.appendChild(r);
                    });
                };

                // EV panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.ev_filters");
                    const evGrid = doc.createElement("div");
                    evGrid.className = "ct-col-2";
                    body.appendChild(evGrid);
                    const eu = doc.createElement("div");
                    eu.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.eu")}</div>`;
                    appendKeys(eu, ["ev_socket_type2", "ev_socket_ccs", "ev_socket_chademo", "ev_socket_schuko"]);
                    const na = doc.createElement("div");
                    na.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.na")}</div>`;
                    appendKeys(na, ["ev_socket_type1", "ev_socket_ccs1", "ev_socket_nacs", "ev_socket_tesla_sc", "ev_socket_nema1450", "ev_socket_nema515", "ev_socket_nema520", "ev_socket_tt30", "ev_socket_tesla_dest"]);
                    evGrid.appendChild(eu);
                    evGrid.appendChild(na);
                    appendKeys(body, ["ev_min_kw"]);
                    const evHdr = row("ev_hdr");
                    if (evHdr?.parentNode) evHdr.parentNode.removeChild(evHdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_ev");
                }

                // Lodging panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.lodging");
                    appendKeys(body, ["lod_hotel", "lod_motel", "lod_guest_house", "lod_hostel", "lod_alpine_hut", "lod_camp_site", "lod_caravan_site", "lod_chalet", "lod_shower", "lod_toilets", "lod_drinking_water", "lod_wifi", "lod_reservation", "lod_free_only"]);
                    const hdr = row("lod_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_lodging");
                }

                // Attraction panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.attraction");
                    const grid = doc.createElement("div");
                    grid.className = "ct-col-3";
                    body.appendChild(grid);
                    const col1 = doc.createElement("div");
                    col1.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.culture")}</div>`;
                    appendKeys(col1, ["att_c_museum", "att_c_artwork", "att_c_castle", "att_c_ruins", "att_c_monument", "att_c_memorial", "att_c_archaeo", "att_c_church"]);
                    const col2 = doc.createElement("div");
                    col2.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.nature")}</div>`;
                    appendKeys(col2, ["att_n_viewpoint", "att_n_picnic", "att_n_peak", "att_n_volcano", "att_n_waterfall", "att_n_cave"]);
                    const col3 = doc.createElement("div");
                    col3.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.recreation")}</div>`;
                    appendKeys(col3, ["att_r_themepark", "att_r_zoo", "att_r_aquarium", "att_r_gallery", "att_r_planetarium", "att_r_coaster"]);
                    grid.appendChild(col1);
                    grid.appendChild(col2);
                    grid.appendChild(col3);
                    const hdr = row("att_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_attraction");
                }

                // Parking panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.parking");
                    appendKeys(body, ["pk_free_only", "pk_covered_only", "pk_paved_only", "pk_pnr_only", "pk_motorhome_ok", "pk_min_capacity", "pk_disabled_only", "pk_maxheight"]);
                    const hdr = row("pk_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_parking");
                }

                // Rest panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.rest");
                    appendKeys(body, ["rest_toilets", "rest_drinking", "rest_shelter", "rest_picnic", "rest_overnight", "rest_hgv_cap_only"]);
                    const hdr = row("rest_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_rest");
                }

                // Fuel panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.fuel");
                    const grid = doc.createElement("div");
                    grid.className = "ct-col-2";
                    body.appendChild(grid);
                    const fuels = doc.createElement("div");
                    fuels.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.fuel_types")}</div>`;
                    appendKeys(fuels, ["fu_diesel", "fu_petrol", "fu_e10", "fu_e85", "fu_lpg", "fu_cng"]);
                    const misc = doc.createElement("div");
                    misc.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.other")}</div>`;
                    appendKeys(misc, ["fu_open_247", "fu_brand"]);
                    grid.appendChild(fuels);
                    grid.appendChild(misc);
                    const hdr = row("fu_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_fuel");
                }

                // Food panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.food");
                    const grid = doc.createElement("div");
                    grid.className = "ct-col-2";
                    body.appendChild(grid);
                    const kinds = doc.createElement("div");
                    kinds.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.kinds")}</div>`;
                    appendKeys(kinds, ["fd_restaurant", "fd_fastfood", "fd_cafe", "fd_pubbar"]);
                    const diet = doc.createElement("div");
                    diet.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.diet")}</div>`;
                    appendKeys(diet, ["fd_vegan", "fd_vegetarian"]);
                    grid.appendChild(kinds);
                    grid.appendChild(diet);
                    const hdr = row("fd_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_food");
                }

                // Store panel (expanded)
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.store");
                    const grid = doc.createElement("div");
                    grid.className = "ct-col-3";
                    body.appendChild(grid);

                    const col1 = doc.createElement("div");
                    col1.innerHTML = `<div class="ct-subhead">${tt("edit.subhead.kinds")}</div>`;
                    appendKeys(col1, ["st_supermarket", "st_convenience", "st_bakery", "st_pharmacy", "st_medical_supply", "st_brand"]);

                    const col2 = doc.createElement("div");
                    appendKeys(col2, ["st_hardware", "st_outdoor", "st_sports", "st_camping", "st_bicycle"]);

                    const col3 = doc.createElement("div");
                    appendKeys(col3, ["st_clothes", "st_shoes", "st_electronics", "st_mobile_phone", "st_computer", "st_car_repair", "st_car_parts", "st_motorcycle", "st_laundry", "st_dry_cleaning"]);

                    grid.appendChild(col1);
                    grid.appendChild(col2);
                    grid.appendChild(col3);

                    const hdr = row("st_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_store");
                }

                // Terminal panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.terminal");
                    appendKeys(body, ["tm_rail", "tm_bus", "tm_ferry", "tm_airport", "tm_platform", "tm_wheelchair"]);
                    const hdr = row("tm_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_terminal");
                }

                // RV panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.rv");
                    appendKeys(body, ["rv_dump", "rv_water", "rv_power", "rv_showers", "rv_toilets", "rv_free_only"]);
                    const hdr = row("rv_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_rv");
                }

                // Wildcamp panel
                {
                    const
                    {
                        d,
                        body
                    } = makeDetails("edit.panel.wildcamp");
                    appendKeys(body, ["wc_allow_informal", "wc_only_basic"]);
                    const hdr = row("wc_hdr");
                    if (hdr?.parentNode) hdr.parentNode.removeChild(hdr);
                    bottom.appendChild(d);
                    linkVisibility(d, "poi_wildcamp");
                }

                function syncBottomVisibility()
                {
                    const anyVisible = Array.from(bottom.querySelectorAll("details.ct-sub")).some(el => !el.classList.contains("ct-hidden"));
                    bottom.classList.toggle("ct-hidden", !anyVisible);
                }
                syncBottomVisibility();
            };
        }
        // ---- End of menu

        // Keep your existing helper as-is (opens external links in new tab on cache pages)
        function open_new_page()
        {
            var existCondition = setInterval(function ()
            {
                if ($('#cachetur-tur-valg').length)
                {
                    clearInterval(existCondition);
                    var addresses = document.querySelectorAll("#ctl00_ContentBody_LongDescription a");
                    for (var i = 0; i < addresses.length; i++)
                    {
                        addresses[i].addEventListener("click", function (event)
                        {
                            event.stopImmediatePropagation();
                        }, true);
                        addresses[i].setAttribute('target', '_blank');
                    }
                }
            }, 100);
        }

        // open new page end
    /* [TCA2] extracted ctStart */
    /* [TCA2] extracted ctPreInit */
    /* [TCA2] extracted ctCheckLogin */



        function ctInvalidateLogin()
        {
            _ctCacheturUser = '';
            $("#cachetur-header").remove();
        }
    /* [TCA2] extracted ctApiCall */


        function ctInit(force)
        {
            // Prevent duplicate initialization unless explicitly forced
            if (_initialized && !force) return;

            console.log("Initializing Cacheturassistenten");
            console.log("-> calling ctCreateTripList");
            ctCreateTripList();
            console.log("-> calling ctInitAddLinks");
            ctInitAddLinks();

            // --- Run CT_POI only on real map pages ---
            // (Keep menu and language loading on every page.)
            const ALLOW_CT_POI = new Set(["gc_map_new", "gc_map", "pgc_map", "pgc_map2"]);
            const page = (typeof _ctPage !== "undefined") ? _ctPage : "";

            if (ALLOW_CT_POI.has(page))
            {
                // Allowed map page: create the real CT_POI
                createCT_POI();
                window.CT_DISABLE_POI = false;
            }
            else
            {
                // Non-map page: disable POI and provide a harmless stub so the menu doesn't break
                window.CT_DISABLE_POI = true;
                if (!window.CT_POI)
                {
                    window.CT_POI = {
                        init: function ()
                        {
                            /* no-op */
                        },
                        destroy: function ()
                        {
                            /* no-op */
                        },
                        apply: function ()
                        {
                            /* no-op */
                        },
                        enabled: false
                    };
                }
            }

            // Mark assistant as initialized
            _initialized = true;

            // Start the menu (will detect CT_DISABLE_POI and/or use the stub on non-map pages)
            ctStartmenu();
        }
    /* [TCA2] extracted ctInitNotLoggedIn */


        function ctInitInactive()
        {

            if (_initialized) return;
            console.log("Assistant not being actively used, disabling");
            if (_ctPage === "gc_geocache" || _ctPage === "gc_bmlist" || _ctPage === "bobil") GM_addStyle("nav .wrapper { max-width: unset; } #gc-header {background-color: #02874d; color: white; font-size: 16px; height: fit-content; width: 100%;} .player-profile {width: fit-content;} #gc-header nav {align-items: center; height: fit-content; box-sizing: border-box; display: flex; max-width: fit-content; min-height: 80px; overflow: visible; padding: 0 12px; position: relative !important; width: 100vw;} #cachetur-header { padding: 8px 1em 22px 2em; } #cachetur-tur-valg { float:left; width: 200px; height: 24px; overflow: hidden; background: #eee; color: black; border: 1px solid #ccc; } #cachetur-header-text { padding-right: 3px; float:left;  } ");
            else if (_ctPage === "gc_map") GM_addStyle("#cachetur-header button { width: 26px; } #cachetur-header { ;padding-top:8px; } #gc-header {background-color: #02874d; color: white; font-size: 16px; height: fit-content; width: 100%;} .player-profile {width: fit-content;} #cachetur-header-text { padding-right: 3px; float:left; }");
            else if (_ctPage === "gc_map_new" || _ctPage === "gc_gctour") GM_addStyle("#cachetur-header button { width: 26px; } #cachetur-header { ;padding-top:8px; } #gc-header {background-color: #02874d; color: white; font-size: 16px; height: fit-content; width: 100%;} .player-profile {width: fit-content;} #cachetur-header-text { padding-right: 3px; float:left; }");
            else if (_ctPage === "pgc_map" || _ctPage === "pgc_map2" || _ctPage === "pgc_vgps") GM_addStyle("#cachetur-header { margin-top: 12px; }");

            if ($('#GClh_II_running')[0] && $('gclh_nav#ctl00_gcNavigation')[0])
            {

                ctPrependToHeader2('<li id="cachetur-header"><span id="cachetur-header-text"><img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" /> <a href id="cachetur-activate">' + i18next.t("activate.button") + '</a></li>');
                $('#cachetur-activate')[0].onclick = function ()
                {
                    GM_setValue("cachetur_last_action", Date.now());
                };

                $("#cachetur-activate").click(function (e)
                {
                    GM_setValue("cachetur_last_action", Date.now());
                });
            }
            else
            {

                ctPrependToHeader('<li id="cachetur-header"><span id="cachetur-header-text"><img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" /> <a href id="cachetur-activate">' + i18next.t("activate.button") + '</a></li>');
                $('#cachetur-activate')[0].onclick = function ()
                {
                    GM_setValue("cachetur_last_action", Date.now());
                };

                $("#cachetur-activate").click(function (e)
                {
                    GM_setValue("cachetur_last_action", Date.now());
                });
            }
            _initialized = true;

        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 0) Mark the <body> with the current page type (call once early during init)
        // ─────────────────────────────────────────────────────────────────────────────
        function ctMarkPageOnBody()
        {
            try
            {
                document.body.classList.add('ct-page-' + _ctPage);
            }
            catch (_)
            {}
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 1) Give the header a page-specific class
        // ─────────────────────────────────────────────────────────────────────────────
        function ctHeaderClass()
        {
            if (_ctPage === 'pgc_map' || _ctPage === "pgc_map2" || _ctPage === 'pgc_vgps') return 'ct-pgc';
            if (_ctPage === 'gc_gctour') return 'ct-gctour';
            if (_ctPage === 'gc_map_new' || _ctPage === 'gc_bmlist') return 'ct-gc-react';
            if (_ctPage === 'gc_geocache' || _ctPage === 'gc_map') return 'ct-gc-classic';
            if (_ctPage === 'bobil') return 'ct-cachetur';
            return 'ct-default';
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 2) Build the header HTML (use this when you inject the header)
        // ─────────────────────────────────────────────────────────────────────────────
        function ctBuildHeaderHtml(optionsHtml)
        {
            return '' +
                '<li id="cachetur-header" class="' + ctHeaderClass() + '">' +
                '  <span id="cachetur-header-text">' +
                '    <img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" ' +
                '         title="' + i18next.t('menu.loggedinas') + ' ' + _ctCacheturUser + '"/> ' +
                i18next.t('menu.addto') +
                '  </span>' +
                '  <select id="cachetur-tur-valg">' + optionsHtml + '</select>' +
                '  <button id="cachetur-tur-open" class="cachetur-menu-button" type="button" ' +
                '          title="' + i18next.t('menu.opentrip') + '"><img src="https://cachetur.no/api/img/arrow.png" style="height:16px;"/></button>' +
                '  <button id="cachetur-tur-refresh" type="button" class="cachetur-menu-button" ' +
                '          title="' + i18next.t('menu.refresh') + '"><img src="https://cachetur.no/api/img/refresh.png" style="height:16px;"/></button>' +
                '  <button id="cachetur-tur-add-ct-caches" type="button" class="cachetur-menu-button" ' +
                '          title="' + i18next.t('menu.showonmap') + '"><img src="https://cachetur.no/api/img/map.png" style="height:16px;"/></button>' +
                '  <button id="cachetur-tur-fitbounds" class="cachetur-menu-button" type="button" ' +
                '          title="' + i18next.t('menu.fitroute') + '"><img src="https://cachetur.no/api/img/zoom.png" style="height:16px;"/></button>' +
                '  <span id="cachetur-tur-antall-container">(<span id="cachetur-tur-antall"></span>)</span>' +
                '</li>';
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 3) Apply theme class to the injected header (call after you insert headerHtml)
        // ─────────────────────────────────────────────────────────────────────────────
        function ctApplyHeaderTheme()
        {
            const klass = ctHeaderClass();
            const $el = $('#cachetur-header');
            if (!$el.length) return;
            const base = ($el.attr('class') || '')
                .split(/\s+/)
                .filter(n => n && !/^ct-/.test(n));
            $el.attr('class', base.concat(klass).join(' '));
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 4) Install all header styles once (call once during init)
        // ─────────────────────────────────────────────────────────────────────────────
        function ctInstallHeaderStylesOnce()
        {
            if (window.__ctHeaderCssLoaded) return;
            window.__ctHeaderCssLoaded = true;

            GM_addStyle(`
        /* ================= Base (applies everywhere) ================= */
        #cachetur-header{
          display:flex; align-items:center; gap:8px;
          position:relative; z-index:1050; /* keep <select> above the navbar */
        }
        #cachetur-header img[alt="cachetur.no"]{
          height:20px; margin-right:4px; vertical-align:middle;
        }
        #cachetur-header .cachetur-menu-button{
          display:inline-flex; align-items:center; justify-content:center;
          height:28px; width:28px; padding:0; line-height:0;
          border-radius:14px; border:1px solid transparent;
          background:transparent; cursor:pointer;
        }
        #cachetur-header .cachetur-menu-button img{
          display:block; width:16px; height:16px;
        }
        #cachetur-tur-valg{
          min-width:240px; max-width:45vw;
          height:32px; line-height:32px; padding:0 8px;
          background:#fff; color:#4a4a4a; border:1px solid rgba(0,0,0,.15);
          appearance:auto; -webkit-appearance:auto; overflow:visible;
          border-radius:6px;
        }
        #cachetur-tur-antall-container{ margin-left:4px; font-weight:600 }

        /* Don't clip dropdowns in the top bars (GC & PGC) */
        #gc-header, #gc-header nav, .user-menu, .header-top,
        #pgc-navbar-body, #pgcMainMenu, #pgcMainMenu .navbar, #pgcMainMenu .navbar-nav {
          overflow: visible !important;
        }

        /* ================= Project-GC (Bootstrap-like navbar) ================= */
        #cachetur-header.ct-pgc{
          font-family: var(--bs-font-sans-serif) !important;
          color: var(--bs-body-color);
          padding: .25rem 0;
          gap: .375rem;
          font-size: .875rem;
        }
        #cachetur-header.ct-pgc #cachetur-tur-valg{
          min-width:200px;
          height:28px; line-height:28px; padding:0 .5rem;
          background: var(--bs-white);
          color: var(--bs-body-color);
          border: 1px solid var(--bs-border-color);
          border-radius: .25rem;
        }
        #cachetur-header.ct-pgc .cachetur-menu-button{
          height:10px; width:10px; line-height:0;
          border: 1px solid var(--bs-border-color);
          border-radius: .25rem;
          background: var(--bs-light-bg-subtle);
          box-shadow: none;
        }
        #cachetur-header.ct-pgc .cachetur-menu-button:hover{
          background: var(--bs-gray-200);
          border-color: var(--bs-gray-400);
        }
        #cachetur-header.ct-pgc .cachetur-menu-button img{
          width:10px; height:10px;
        }

        /* ================= GC React pages (map_new, bmlist) ================= */
        #cachetur-header.ct-gc-react{ color:#fff; padding:8px 0 }
        #cachetur-header.ct-gc-react #cachetur-tur-valg{ min-width:260px }
        #cachetur-header.ct-gc-react .cachetur-menu-button{
          background: rgba(255,255,255,.08);
          border-color: rgba(255,255,255,.25);
        }
        #cachetur-header.ct-gc-react .cachetur-menu-button:hover{
          background: rgba(255,255,255,.18);
          border-color: rgba(255,255,255,.45);
        }

        /* ================= GC classic (gc_map, gc_geocache) ================= */
        #cachetur-header.ct-gc-classic{ color:#fff; padding:8px 0 }
        #cachetur-header.ct-gc-classic #cachetur-tur-valg{ min-width:220px }
        #cachetur-header.ct-gc-classic .cachetur-menu-button{
          background: rgba(255,255,255,.08);
          border-color: rgba(255,255,255,.25);
        }
        #cachetur-header.ct-gc-classic .cachetur-menu-button:hover{
          background: rgba(255,255,255,.18);
          border-color: rgba(255,255,255,.45);
        }

        /* ================= GC GeoTours ================= */
        #cachetur-header.ct-gctour{ color:#fff; padding:8px 0 }
        #cachetur-header.ct-gctour #cachetur-tur-valg{ min-width:260px }
        #cachetur-header.ct-gctour .cachetur-menu-button{
          background: rgba(255,255,255,.08);
          border-color: rgba(255,255,255,.25);
        }
        #cachetur-header.ct-gctour .cachetur-menu-button:hover{
          background: rgba(255,255,255,.18);
          border-color: rgba(255,255,255,.45);
        }

        /* ================= cachetur.no (bobil) ================= */
        #cachetur-header.ct-cachetur{ color:#333; padding:8px 0 }
        #cachetur-header.ct-cachetur .cachetur-menu-button{
          background:#eee; border-color:rgba(0,0,0,.1);
        }
        #cachetur-header.ct-cachetur .cachetur-menu-button:hover{
          background:#e2e2e2; border-color:rgba(0,0,0,.2);
        }

        /* ================= Page-specific exceptions ================= */
        body.ct-page-gc_bmlist #cachetur-tur-fitbounds,
        body.ct-page-gc_bmlist #cachetur-tur-add-ct-caches { display:none; }

        /* Widen the nav area & trip dropdown specifically on gc_geocache and gc_gctour */
        body.ct-page-gc_geocache #gc-header nav,
        body.ct-page-gc_gctour  #gc-header nav {
          max-width: none !important;
          width: 100vw !important;
        }
        body.ct-page-gc_geocache #gc-header .user-menu,
        body.ct-page-gc_gctour  #gc-header .user-menu { flex-wrap: nowrap !important; }
        body.ct-page-gc_geocache #cachetur-header #cachetur-tur-valg,
        body.ct-page-gc_gctour  #cachetur-header #cachetur-tur-valg {
          min-width:320px !important;
          width: clamp(320px, 32vw, 520px) !important;
          height: 28px !important;
        }
      `);
        }


        function ctPrependToHeader(data)
        {
            console.log("Injecting cachetur.no in menu");
            waitForKeyElements("div.user-menu");
            $(".hamburger--squeeze").remove();

            let header = null;
            if (["gc_map", "gc_gctour", "gc_map_new", "gc_bmlist", "gc_geocache"].includes(_ctPage))
            {
                header = $('.user-menu');
            }
            else if (_ctPage === "bobil")
            {
                header = $('.navbar-right');
            }
            else if (["pgc_map", "pgc_map2", "pgc_vgps"].includes(_ctPage))
            {
                header = $('#pgc-navbar-body > ul.navbar-nav').last();
            }

            if (header && header.length)
            {
                ctInsert(data, header, 'prepend');
                ctApplyHeaderTheme(); // <— legger på riktig tema-klasse
            }
        }

        function ctPrependToHeader2(data)
        {
            console.log("Injecting cachetur.no in menu (GClh-nav)");

            // Find GClh wrapper + both lists
            const $wrap = $('gclh_nav#ctl00_gcNavigation .wrapper');
            const $menu = $wrap.find('ul.menu').first();
            const $login = $wrap.find('ul#ctl00_uxLoginStatus_divSignedIn').first();

            // Only do the "between" placement on gc_map / gc_gctour when GClh II is present
            const onGcOldTopbar =
                $('#GClh_II_running').length > 0 &&
                $wrap.length > 0 && $menu.length > 0 && $login.length > 0 &&
                (_ctPage === 'gc_map' || _ctPage === 'gc_gctour');

            if (onGcOldTopbar)
            {
                if (!document.getElementById('cachetur-header'))
                {
                    // Insert Cachetur <li> right AFTER the main menu list (i.e. between menu and login area)
                    $menu.after(data);
                }

                // Layout + theme fixes for classic GClh topbar
                GM_addStyle(`
          /* Make the outer nav and wrapper span the full width and start from the very left */
          gclh_nav {
            width: 100% !important;
            display: block !important;
            height: auto !important;            /* auto height, we keep min-height on wrapper */
            position: static !important;
          }

          gclh_nav .wrapper {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important; /* start everything at the left edge */
            gap: 10px !important;
            flex-wrap: nowrap !important;

            width: 100% !important;
            height: auto !important;
            min-height: 80px !important;

            /* kill any centering/max-width from site CSS */
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;

            overflow: visible !important;
            background-color: #02874d !important; /* keep GC green */
            box-sizing: border-box !important;
          }

          /* Main menu as a horizontal row */
          gclh_nav ul.menu {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          gclh_nav ul.menu > li { list-style: none !important; }
          gclh_nav ul.menu > li::marker { content: none !important; }

          /* User panel on the far right */
          gclh_nav #ctl00_uxLoginStatus_divSignedIn {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            margin-left: auto !important; /* push to the right */
            padding: 0 !important;
          }
          gclh_nav #ctl00_uxLoginStatus_divSignedIn > li { list-style: none !important; }
          gclh_nav #ctl00_uxLoginStatus_divSignedIn > li::marker { content: none !important; }

          /* Our injected Cachetur header (<li>) */
          gclh_nav #cachetur-header {
            list-style: none !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin: 0 6px !important;
            padding: 0 !important;
            height: auto !important;            /* never force 80px height here */
            line-height: 1.3 !important;
          }
          gclh_nav #cachetur-header::marker { content: none !important; }
          gclh_nav #cachetur-header select { height: 28px !important; }

          /* Prevent clipping of any dropdowns/menus */
          gclh_nav .wrapper, gclh_nav { overflow: visible !important; }
        `);

            }
            else
            {
                // Fallback for other pages
                let header = null;
                if (["gc_map", "gc_gctour", "gc_map_new", "gc_bmlist", "gc_geocache"].includes(_ctPage))
                {
                    header = $('#ctl00_uxLoginStatus_divSignedIn');
                    GM_addStyle(`
            /* Full-width, left-aligned on React/new pages too */
            gclh_nav { width: 100% !important; display: block !important; height: auto !important; }
            gclh_nav .wrapper {
              display: flex !important;
              align-items: center !important;
              justify-content: flex-start !important;
              gap: 10px !important;
              width: 100% !important;
              height: auto !important;
              min-height: 80px !important;
              max-width: none !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              background-color: #02874d !important;
              box-sizing: border-box !important;
            }
          `);
                }
                else if (_ctPage === "bobil")
                {
                    header = $('.navbar-right');
                }
                else if (["pgc_map", "pgc_map2", "pgc_vgps"].includes(_ctPage))
                {
                    header = $('#pgcMainMenu ul.navbar-right');
                }

                if (header && header.length && !document.getElementById('cachetur-header'))
                {
                    // Keep it a <li> inside the existing <ul>
                    header.prepend(data);
                    GM_addStyle(`
            #cachetur-header { list-style: none !important; display: inline-flex !important; align-items: center !important; gap: 8px !important; }
            #cachetur-header::marker { content: none !important; }
          `);
                }
            }

            // Apply current theme/colors for Cachetur header content (existing helper)
            ctApplyHeaderTheme();
        }

        function ctPrependTouser(data)
        {

            let header;
            if (_ctPage === "gc_map" || _ctPage === "gc_map_new" || _ctPage === "gc_gctour" || _ctPage === "gc_bmlist" || _ctPage === "gc_geocache") header = $('span.username');

            if (header)
            {
                ctInsert(data, header, 'append');
                waitForKeyElements("#pgc", function ()
                {
                    $("#cachetur-header1").remove();
                    $("#cachetur-header1").remove();

                });
            }

        }

        function ctPrependTousergclh(data)
        {

            let header;
            if (_ctPage === "gc_map" || _ctPage === "gc_map_new" || _ctPage === "gc_gctour" || _ctPage === "gc_bmlist" || _ctPage === "gc_geocache") header = $('.user-name');

            if (header)
            {
                ctInsert(data, header, 'append');
                waitForKeyElements("#pgc_gclh", function ()
                {
                    $("#cachetur-header2").remove();

                });
            }

        }

        function ctCreateTripList()
        {
            console.log("ctCreateTripList: start; user =", _ctCacheturUser || "(empty)", "page =", _ctPage);

            if (!_ctCacheturUser)
            {
                console.log("ctCreateTripList: abort (not logged in)");
                return;
            }

            // give body a page class for possible special exceptions in CSS
            document.body.classList.add('ct-page-' + _ctPage);

            ctApiCall("planlagt_list_editable",
            {
                includetemplates: "true"
            }, function (available)
            {
                const hasTrips = Array.isArray(available) && available.length > 0;

                // build the <option> list robustly
                if (hasTrips)
                {
                    optionsHtml = available.map(function (item)
                    {
                        return '<option value="' + item.id + '">' + item.turnavn + '</option>';
                    }).join("");
                }
                else
                {
                    // fallback when no trips are found
                    optionsHtml = '<option value="" disabled selected>' + i18next.t('menu.notrips') + '</option>';
                }

                // If the select already exists in the DOM, update it
                const $sel = $("#cachetur-tur-valg");
                if ($sel.length)
                {
                    $sel.html(optionsHtml);
                }

                // HTML for the header (markup only)
                const headerHtml =
                    '<li id="cachetur-header">' +
                    '  <span id="cachetur-header-text">' +
                    '    <img src="https://cachetur.net/img/logo_top.png" alt="cachetur.no" title="' + i18next.t('menu.loggedinas') + ' ' + _ctCacheturUser + '"/> ' +
                    i18next.t('menu.addto') +
                    '  </span>' +
                    '  <select id="cachetur-tur-valg">' + optionsHtml + '</select>' +
                    '  <button id="cachetur-tur-open" class="cachetur-menu-button" type="button" title="' + i18next.t('menu.opentrip') + '"><img src="https://cachetur.no/api/img/arrow.png" style="height:16px;"/></button>' +
                    '  <button id="cachetur-tur-refresh" type="button" class="cachetur-menu-button" title="' + i18next.t('menu.refresh') + '"><img src="https://cachetur.no/api/img/refresh.png" style="height:16px;"/></button>' +
                    '  <button id="cachetur-tur-add-ct-caches" type="button" class="cachetur-menu-button" title="' + i18next.t('menu.showonmap') + '"><img src="https://cachetur.no/api/img/map.png" style="height:16px;"/></button>' +
                    '  <button id="cachetur-tur-fitbounds" class="cachetur-menu-button" type="button" title="' + i18next.t('menu.fitroute') + '"><img src="https://cachetur.no/api/img/zoom.png" style="height:16px;"/></button>' +
                    '  <span id="cachetur-tur-antall-container">(<span id="cachetur-tur-antall"></span>)</span>' +
                    '</li>';

                function bindHeaderEvents()
                {
                    const $tripSelector = $("#cachetur-tur-valg");
                    if (!$tripSelector.length) return;

                    /// no trips → disable buttons and done
                    if (!hasTrips)
                    {
                        $("#cachetur-tur-open,#cachetur-tur-refresh,#cachetur-tur-add-ct-caches,#cachetur-tur-fitbounds").prop('disabled', true);
                        $("#cachetur-tur-antall").text("0");
                        return;
                    }

                    // initialize selected trip from storage (or first)
                    let storedTrip = GM_getValue("cachetur_selected_trip", 0);
                    if ($tripSelector.find('option[value="' + storedTrip + '"]').length === 0)
                    {
                        storedTrip = $tripSelector.children("option").first().val() || 0;
                        GM_setValue("cachetur_selected_trip", storedTrip);
                    }
                    $tripSelector.val(storedTrip);

                    // load data for selected trip
                    ctGetAddedCodes(storedTrip);
                    ctGetTripRoute(storedTrip);

                    // avoid double binding
                    $("#cachetur-tur-open,#cachetur-tur-refresh,#cachetur-tur-add-ct-caches,#cachetur-tur-fitbounds").off("click");
                    $tripSelector.off("change");

                    $tripSelector.on("change", function ()
                    {
                        const id = $tripSelector.val();
                        ctGetAddedCodes(id);
                        ctGetTripRoute(id);
                        GM_setValue("cachetur_selected_trip", id);
                        GM_setValue("cachetur_last_action", Date.now());
                    });

                    $("#cachetur-tur-open").on("click", function ()
                    {
                        const selected = $tripSelector.val();
                        let url = "https://cachetur.no/";
                        if (selected.endsWith("L")) url += "liste/" + selected.slice(0, -1);
                        else if (selected.endsWith("T")) url += "template/" + selected.slice(0, -1);
                        else url += "fellestur/" + selected;
                        GM_openInTab(url);
                    });

                    $("#cachetur-tur-refresh").on("click", function ()
                    {
                        const id = $tripSelector.val();
                        $("#cachetur-tur-antall").text("Loading");

                        ctApiCall("planlagt_list_editable",
                        {
                            includetemplates: "true"
                        }, function (avail)
                        {
                            const ok = Array.isArray(avail) && avail.length > 0;
                            let opts = ok ? avail.map(it => '<option value="' + it.id + '">' + it.turnavn + '</option>').join("") :
                                '<option value="" disabled selected>' + i18next.t('menu.notrips') + '</option>';

                            $tripSelector.empty().append(opts);
                            if (ok && $tripSelector.find('option[value="' + id + '"]').length)
                            {
                                $tripSelector.val(id);
                                ctGetAddedCodes(id);
                                ctGetTripRoute(id);
                            }
                            else
                            {
                                $("#cachetur-tur-open,#cachetur-tur-add-ct-caches,#cachetur-tur-fitbounds").prop('disabled', !ok);
                                $("#cachetur-tur-antall").text(ok ? "" : "0");
                            }
                            GM_setValue("cachetur_last_action", Date.now());
                        });
                    });

                    $("#cachetur-tur-add-ct-caches").on("click", function ()
                    {
                        const id = $tripSelector.val();
                        ctAddCacheMarkersToMap(id);
                    });

                    $("#cachetur-tur-fitbounds").on("click", function ()
                    {
                        const map = ctGetUnsafeLeafletObject();
                        if (map && unsafeWindow.cacheturRouteLayer)
                        {
                            map.fitBounds(unsafeWindow.cacheturRouteLayer.getBounds());
                        }
                        if (_ctPage === "gc_map_new")
                        {
                            $("#clear-map-control").trigger("click");
                        }
                    });
                }

                // inject header (avoid duplicates)
                function injectHeaderOnce()
                {
                    if (document.getElementById("cachetur-header"))
                    {
                        bindHeaderEvents();
                        return;
                    }
                    const useOldTopbar = ($('#GClh_II_running')[0] && $('gclh_nav#ctl00_gcNavigation')[0]);
                    if (useOldTopbar) ctPrependToHeader2(headerHtml);
                    else ctPrependToHeader(headerHtml);

                    // add the correct theme class
                    ctApplyHeaderTheme();
                    bindHeaderEvents();
                }

                injectHeaderOnce();

                // Re-inject on SPA updates (map_new/geotours/live)
                if (["gc_gctour", "gc_map_new"].includes(_ctPage) && !window.__cacheturHeaderWatcher)
                {
                    window.__cacheturHeaderWatcher = true;
                    const mo = new MutationObserver(function ()
                    {
                        if (_ctCacheturUser && !document.getElementById("cachetur-header"))
                        {
                            injectHeaderOnce();
                        }
                    });
                    try
                    {
                        mo.observe(document.body,
                        {
                            childList: true,
                            subtree: true
                        });
                    }
                    catch
                    {}
                }
            });
        }

        function ctGetAddedCodes(id)
        {
            ctApiCall("planlagt_get_codes",
                {
                    "tur": id,
                    "useid": false
                },
                function (codes)
                {
                    if (codes.length <= 0) return;

                    _ctCodesAdded = [];

                    codes.forEach(function (item)
                    {
                        _ctCodesAdded.push(item);
                    });

                    ctUpdateAddImage();
                    ctPGCMarkFound();
                    ctPGCCheckVgps();
                    ctCheckList();

                    $('#cachetur-tur-antall').html(_ctCodesAdded.length);
                }
            );
        }

        function ctGetTripRoute(id)
        {
            if (!id || id.endsWith('L'))
            {
                $("#cachetur-tur-fitbounds").prop('disabled', true);
                return;
            }

            let unsafeLeafletObject = ctGetUnsafeLeafletObject();
            if (unsafeLeafletObject === null)
            {
                $("#cachetur-tur-fitbounds").prop('disabled', true);
                $("#cachetur-tur-add-ct-caches").prop('disabled', true);
                console.log("ERROR: Can't find leaflet object");
                return;
            }

            if (unsafeWindow.cacheturCacheLayer)
            {
                unsafeLeafletObject.removeLayer(unsafeWindow.cacheturCacheLayer);
            }

            console.log("Attempting to fetch route for selected trip");

            ctApiCall("planlagt_get_route",
                {
                    "tur": id
                },
                function (data)
                {
                    if (unsafeWindow.cacheturRouteLayer)
                    {
                        unsafeLeafletObject.removeLayer(unsafeWindow.cacheturRouteLayer);
                    }

                    if (data.length <= 0)
                    {
                        console.log("Couldn't find any route for given trip/list");
                        $("#cachetur-tur-fitbounds").prop('disabled', true);
                        return;
                    }

                    console.log("Route data received, constructing route");

                    _routeLayer = L.polyline(data,
                    {
                        color: 'purple'
                    });
                    _routeLayer.getAttribution = function ()
                    {
                        return 'Directions powered by <a href="https://www.graphhopper.com/" target="_blank">GraphHopper API</a>, delivered by <a href="https://cachetur.no">cachetur.no</a>';
                    };
                    unsafeWindow.cacheturRouteLayer = cloneInto(_routeLayer, unsafeWindow);

                    console.log("Injecting route");
                    unsafeLeafletObject.addLayer(unsafeWindow.cacheturRouteLayer);

                    $("#cachetur-tur-fitbounds").prop('disabled', false);
                    $("#cachetur-tur-add-ct-caches").prop('disabled', false);
                });

            ctApiCall("planlagt_get_noncaches",
                {
                    "tur": id
                },
                function (data)
                {
                    if (unsafeWindow.cacheturWaypointsLayer)
                    {
                        unsafeLeafletObject.removeLayer(unsafeWindow.cacheturWaypointsLayer);
                    }

                    if (data.length <= 0)
                    {
                        console.log("Couldn't find any waypoints for given trip/list");
                        return;
                    }

                    let markers = [];
                    data.forEach(function (item)
                    {
                        markers.push(L.marker([item.lat, item.lon],
                        {
                            icon: L.divIcon(
                            {
                                className: 'cachetur-map_marker',
                                iconSize: [18, 18],
                                riseOnHover: true,
                                html: '<div class="cachetur-map_marker_symbol " title="' + item.name + '"><img src="' + item.typeicon + '" /></div><span class="label label-default"></span>'
                            })
                        }));
                    });

                    _waypointLayer = L.layerGroup(markers);
                    unsafeWindow.cacheturWaypointsLayer = cloneInto(_waypointLayer, unsafeWindow);

                    console.log("Injecting waypoints");
                    unsafeLeafletObject.addLayer(unsafeWindow.cacheturWaypointsLayer);

                    $("#cachetur-tur-fitbounds").prop('disabled', false);
                    $("#cachetur-tur-add-ct-caches").prop('disabled', false);
                });
        }

        function ctAddCacheMarkersToMap(id)
        {
            console.log("Attempting to fetch cache coordinates for selected trip");

            let unsafeLeafletObject = ctGetUnsafeLeafletObject();
            if (unsafeLeafletObject === null)
            {
                $("#cachetur-tur-fitbounds").prop('disabled', true);
                $("#cachetur-tur-add-ct-caches").prop('disabled', true);
                console.log("ERROR: Can't find leaflet object");
                return;
            }

            ctApiCall("planlagt_get_cachecoordinates",
                {
                    "tur": id
                },
                function (data)
                {
                    if (unsafeWindow.cacheturCacheLayer)
                    {
                        unsafeLeafletObject.removeLayer(unsafeWindow.cacheturCacheLayer);
                    }

                    if (data.length <= 0)
                    {
                        console.log("Couldn't find any cache data for given trip/list");
                        $("#cachetur-tur-fitbounds").prop('disabled', true);
                        return;
                    }

                    console.log("Cache data received, constructing markers");

                    let markers = [];
                    data.forEach(function (item)
                    {
                        markers.push(L.marker([item.lat, item.lon],
                        {
                            icon: L.divIcon(
                            {
                                className: 'cachetur-map_marker',
                                iconSize: [18, 18],
                                riseOnHover: true,
                                html: '<div class="cachetur-map_marker_symbol " title="' + item.name + '"><img src="' + item.typeicon + '" /></div><span class="label label-default"></span>'
                            })
                        }));
                    });

                    _cacheLayer = L.layerGroup(markers);
                    unsafeWindow.cacheturCacheLayer = cloneInto(_cacheLayer, unsafeWindow);

                    console.log("Injecting caches");
                    unsafeLeafletObject.addLayer(unsafeWindow.cacheturCacheLayer);

                    $("#cachetur-tur-fitbounds").prop('disabled', false);
                });
        }

        function ctGetPublicLists(cache)
        {
            ctApiCall("cache_get_lists",
                {
                    "code": cache
                },
                function (data)
                {
                    if (data.length <= 0)
                    {
                        console.log("Couldn't find any lists or trip templates for the given cache");
                        return;
                    }

                    console.log("Injecting list of lists");
                    let alternate = false;
                    let listHtml = '<div class="CacheDetailNavigationWidget"><h3 class="WidgetHeader"><img src="https://cachetur.no/api/img/cachetur-15.png" /> Cachetur.no</h3><div class="WidgetBody"><ul class="BookmarkList">';
                    data.forEach(function (list)
                    {
                        let listElement = '<li class="' + (alternate ? 'AlternatingRow' : '') + '"><a href="https://cachetur.no/' + (list.source === 'triptemplate' ? 'tur' : (list.source === 'trip' ? 'fellestur' : 'liste')) + '/' + list.id + '">' + list.name + '</a><br>' + i18next.t('template.by') + ' ' + list.owner + '</li>';
                        alternate = !alternate;
                        listHtml = listHtml + listElement;
                    });
                    listHtml = listHtml + '</ul></div></div>';

                    $('.sidebar').append(listHtml);
                });
        }

        function ctGetPublicLists_gc_map_new(cache)
        {
            ctApiCall("cache_get_lists",
                {
                    "code": cache
                },
                function (data)
                {
                    if (data.length <= 0)
                    {
                        console.log("Couldn't find any lists or trip templates for the given cache");
                        return;
                    }

                    console.log("Injecting list of lists to geocache ");
                    let alternate = false;
                    let listHtml = '<div class="cachetur-controls-container"><h3 class="WidgetHeader"><img src="https://cachetur.no/api/img/cachetur-15.png" /> Cachetur.no</h3><div class="WidgetBody"><h5>' + i18next.t('lists.in') + '</h5>';
                    data.forEach(function (list)
                    {
                        let listElement = '<li class="' + (alternate ? 'AlternatingRow' : '') + '"><a href="https://cachetur.no/' + (list.source === 'triptemplate' ? 'tur' : (list.source === 'trip' ? 'fellestur' : 'liste')) + '/' + list.id + '">' + list.name + '</a><br>' + i18next.t('template.by') + ' ' + list.owner + '</li>';
                        alternate = !alternate;
                        listHtml = listHtml + listElement;
                    });
                    listHtml = listHtml + '</ul></div></div>';

                    $('.cache-preview-action-menu').prepend(listHtml);
                });
        }

        function ctGetUnsafeLeafletObject()
        {
            const resolvers = {
                "gc_map": () => unsafeWindow.MapSettings ? unsafeWindow.MapSettings.Map : null,
                "gc_map_new": () => unsafeWindow.cacheturGCMap || null,
                "gc_gctour": () => unsafeWindow.cacheturGCMap || null, // NY
                "pgc_map": () => (unsafeWindow.PGC_LiveMap ? unsafeWindow.PGC_LiveMap.map : (unsafeWindow.freeDraw && unsafeWindow.freeDraw.map ? unsafeWindow.freeDraw.map : null)),
                "pgc_map2": () => (unsafeWindow.PGC_LiveMap ? unsafeWindow.PGC_LiveMap.map : (unsafeWindow.freeDraw && unsafeWindow.freeDraw.map ? unsafeWindow.freeDraw.map : null))

            };
            const fn = resolvers[_ctPage];
            return fn ? fn() : null;
        }

        function ctInitAddLinks()
        {
            if (_ctCacheturUser === "") return;

            switch (_ctPage)
            {
                case "gc_geocache":
                    ctAddToCoordInfoLink($("#ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoCode"));
                    tvinfostart();
                    break;

                case "gc_bmlist":
                    ctAddSendListButton();
                    break;

                case "gc_map":
                    // If Google Maps is loaded -> show warning and stop further processing
                    if (document.querySelector("script[src*='//maps.googleapis.com/']"))
                    {
                        waitForKeyElements(".map-cta", function ()
                        {
                            $(".map-wrapper").append(
                                '<large style="color:red; position:absolute; top:62px; right:25px;">' +
                                i18next.t("alerts.google") +
                                "</large>"
                            );
                        });
                        tvinfostart();
                        return;
                    }
                    ctInstallGcPopupWatcher();
                    tvinfostart();
                    break;

                case "gc_gctour":
                    ctInstallGcPopupWatcher();
                    tvinfostart();
                    break;

                case "gc_map_new":
                    if (document.querySelector("script async[src*='maps.googleapis.com/maps-api-v3']"))
                    {
                        console.log("google map");
                        waitForKeyElements("#clear-map-control", function ()
                        {
                            $(".map-container").append(
                                '<large style="color:red; position:absolute; top:62px; right:25px;">' +
                                i18next.t("alerts.google") +
                                "</large>"
                            );
                        });
                        tvinfostart();
                        break;
                    }
                    if (!document.querySelector("primary log-geocache")) ctWatchNewMap();
                    break;

                case "pgc_map":
                    ctInitPGCMap();
                    break;

                case "pgc_map2":
                    ctInitPGCMap();
                    break;

                case "pgc_vgps":
                    ctAddSendPgcVgpsButton();
                    break;
            }
        }

        // Shared watcher for gc_map and gc_gctour (with loop protection)
        function ctInstallGcPopupWatcher()
        {
            console.log("start mutationobserver");
            let targetNode = document.body;
            let config = {
                attributes: true,
                childList: true,
                subtree: true
            };

            // Callback function to execute when mutations are observed
            let callback = function (mutationsList, observer)
            {
                // Check if there are any .code elements present
                let codeElements = targetNode.getElementsByClassName("code");
                if (codeElements.length === 0)
                {
                    return; // Exit if no .code elements are found
                }

                // Get the cache code from the first .code element
                let cacheCode = codeElements[0].innerText;

                // If the cache code hasn't changed, exit
                if (cacheCode === _ctBrowseMapActiveCache)
                {
                    return;
                }

                // Update the active cache code
                _ctBrowseMapActiveCache = cacheCode;

                // Update the data attribute and call the necessary functions
                $(".cachetur-add-code").data("code", cacheCode);
                ctAddToCoordInfoLink($('.code'));
                ctUpdateAddImage();
            };

            // Create an instance of MutationObserver with the callback
            let observer = new MutationObserver(callback);

            // Start observing the target node for configured mutations
            if (targetNode)
            {
                observer.observe(targetNode, config);
                console.log("MutationObserver is set up to watch for changes on browse map.");
            }
            else
            {
                console.error("Target node #gmCacheInfo not found.");
            }

            // Event listener for clicks on .cachetur-add-code elements
            $("body").on("click", ".cachetur-add-code", function (evt)
            {
                evt.stopImmediatePropagation();
                evt.preventDefault();

                let tur = $("#cachetur-tur-valg").val();
                let img = $(this);
                let code = img.data("code");

                ctApiCall("planlagt_add_codes",
                {
                    tur: tur,
                    code: code
                }, function (data)
                {
                    if (data === "Ok")
                    {
                        _ctCodesAdded.push(code);
                        ctUpdateAddImage(true);
                        $('#cachetur-tur-antall').html(_ctCodesAdded.length);
                    }
                    else
                    {
                        if (_ctPage === "gc_geocache")
                        {
                            img.addClass("cachetur-add-code-error");
                        }
                        else if (_ctPage === "gc_map")
                        {
                            img.html('<img src="https://cachetur.no/api/img/cachetur-15-error.png" /> ' + i18next.t('send'));
                        }
                        else
                        {
                            img.attr("src", "https://cachetur.no/api/img/cachetur-15-error.png");
                        }
                    }
                });
            });
        }

        function ctWatchNewMap()
        {
            console.log("start mutationobserver on new search map");
            let targetNode = document.body;
            let config = {
                attributes: true,
                childList: true,
                subtree: true
            };
            let callback = function (mutationsList, observer)
            {

                if (document.getElementsByClassName("primary log-geocache").length === 0)
                {
                    return;
                }
                let cacheCode = document.getElementsByClassName("cache-metadata-code")[0].innerText;

                if (cacheCode === _ctNewMapActiveCache)
                {
                    return;
                }
                _ctNewMapActiveCache = cacheCode;
                $(".cachetur-add-code").data("code", cacheCode);
                ctAddToCoordInfoLink($('.cache-metadata-code'));
                ctUpdateAddImage();

            };


            let observer = new MutationObserver((callback));
            observer.observe(targetNode, config);

            $("body").on("click", ".cachetur-add-code", function (evt)
            {
                evt.stopImmediatePropagation();
                evt.preventDefault();

                let tur = $("#cachetur-tur-valg").val();
                let img = $(this);
                let code = img.data("code");
                ctApiCall("planlagt_add_codes",
                {
                    tur: tur,
                    code: code

                }, function (data)
                {
                    if (data === "Ok")
                    {
                        _ctCodesAdded.push(code);
                        ctUpdateAddImage(true);
                        $('#cachetur-tur-antall').html(_ctCodesAdded.length);
                    }
                    else
                    {
                        if (_ctPage === "gc_geocache")
                        {
                            img.addClass("cachetur-add-code-error");
                        }
                        else if (_ctPage === "gc_map")
                        {
                            img.html('<img src="https://cachetur.no/api/img/cachetur-15-error.png" /> ' + i18next.t('send'));
                        }
                        else
                        {
                            img.attr("src", "https://cachetur.no/api/img/cachetur-15-error.png");
                        }
                    }
                });

            });

        }

        // --- PGC init: inject on data-cacheid changes (robust for re-renders) ---
        function ctInitPGCMap()
        {
            // Allow both PGC map modes; require a Leaflet-based Tools or Maps page
            const path = (window.location.pathname || "").toLowerCase();
            if ((_ctPage !== "pgc_map" && _ctPage !== "pgc_map2") || !(path.includes("/tools/") || path.includes("/maps/")))
            {
                return;
            }
            if (window.__ctPGCInitDone) return;
            const map = ctGetUnsafeLeafletObject();
            if (!map) return;

            console.log("[Cachetur] PGC init (watching data-cacheid)");

            // Helper: inject menu into the popup that owns a given .addtovgps element
            function injectForAddToVgps(el)
            {
                try
                {
                    // Find the real popup content
                    const content = el.closest(".leaflet-popup-content");
                    if (!content) return;

                    // Find the coord.info link (source of the GC code text)
                    const link = content.querySelector("a[href*='//coord.info/']");
                    if (!link) return;

                    // Parent is where we inject (your code expects a jQuery object)
                    const $parent = $(link).parent();

                    // Clean any stale injection if popup node has been reused
                    $parent.find(".cachetur-controls-container").remove();

                    // Only inject if our button is missing
                    if (!$parent.find(".cachetur-add-code").length)
                    {
                        console.log("[Cachetur] Injecting (data-cacheid watcher):", link.textContent.trim());
                        ctAddToVGPSLink($parent);
                    }
                }
                catch (err)
                {
                    console.error("[Cachetur] Injection error:", err);
                }
            }

            // Debounce map-wide: if multiple mutations fire rapidly, batch to next tick
            let pending = new Set();
            let flushTimer = null;

            function schedule(el)
            {
                pending.add(el);
                if (flushTimer) return;
                flushTimer = setTimeout(() =>
                {
                    const els = Array.from(pending);
                    pending.clear();
                    flushTimer = null;
                    els.forEach(injectForAddToVgps);
                }, 60); // small debounce; adjust if needed
            }

            // Observe:
            //  - attribute changes to data-cacheid on .addtovgps
            //  - added popups that include an .addtovgps (first open)
            const mo = new MutationObserver((mutations) =>
            {
                for (const m of mutations)
                {
                    if (m.type === "attributes" &&
                        m.attributeName === "data-cacheid" &&
                        m.target.classList?.contains("addtovgps"))
                    {
                        // PGC just changed which cache this popup represents
                        schedule(m.target);
                    }
                    if (m.type === "childList")
                    {
                        // Check newly added subtrees for .addtovgps (new popup content)
                        m.addedNodes && m.addedNodes.forEach((n) =>
                        {
                            if (n.nodeType !== 1) return;
                            if (n.matches?.(".leaflet-popup-content"))
                            {
                                const btn = n.querySelector(".addtovgps");
                                if (btn) schedule(btn);
                            }
                            else
                            {
                                const btns = n.querySelectorAll?.(".leaflet-popup-content .addtovgps");
                                btns && btns.forEach(schedule);
                            }
                        });
                    }
                }
            });

            mo.observe(document.body,
            {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ["data-cacheid"]
            });

            // Also handle the moment a popup opens (helpful first-run trigger)
            map.on("popupopen", (e) =>
            {
                const btn = $(e.popup._container).find(".leaflet-popup-content .addtovgps").get(0);
                if (btn) schedule(btn);
            });

            // Keep your layer marking (if you use it)
            map.on("layeradd", (layer) =>
            {
                setTimeout(() =>
                {
                    try
                    {
                        ctPGCCheckAndMarkLayer(layer);
                    }
                    catch (err)
                    {
                        console.error("[Cachetur] layeradd error:", err);
                    }
                }, 50);
            });

            window.__ctPGCInitDone = true;
            console.log("[Cachetur] PGC observers ready (data-cacheid + popupopen)");
        }

        function ctAddToVGPSLink(vgps)
        {
            // Guard: ensure we have a jQuery object
            if (!vgps || !vgps.length) return;

            // Inject only if the Cachetur button is not already present
            if (vgps.find(".cachetur-add-code").length === 0)
            {
                // Prefer the coord.info link when extracting the GC code
                const cacheLink = vgps.find("a[href*='//coord.info/']")[0] || vgps.find("a")[0];
                if (!cacheLink) return;

                // Extract GC code robustly
                let gcCode = "";
                try
                {
                    gcCode = (cacheLink.href.split(".info/")[1] || "").toUpperCase();
                    if (!gcCode)
                    {
                        const m = (cacheLink.text || "").match(/GC[A-Z0-9]+/i);
                        if (m) gcCode = m[0].toUpperCase();
                    }
                }
                catch (e)
                {
                    console.warn("[Cachetur] Failed to extract GC code:", e);
                    return;
                }
                if (!gcCode) return;

                // Clean any stale controls if popup DOM was reused
                vgps.find(".cachetur-controls-container").remove();

                // Inject Cachetur button (same look & feel as before)
                vgps.append(
                    '<br><img src="https://cachetur.no/api/img/cachetur-15.png" ' +
                    'title="' + i18next.t("send") + '" class="cachetur-add-code" ' +
                    'style="cursor: pointer; left:20px;" data-code="' + gcCode + '" /><br> '
                );

                // Optional: remove the extra link on non-LiveMap pages (keep original behavior)
                if (window.location.pathname.indexOf("/Tools/LiveMap") === -1)
                {
                    vgps.find("a")[1]?.remove();
                }

                console.log("[Cachetur] Injected Cachetur button for", gcCode);
                ctUpdateAddImage();
            }

            // Bind delegated click handler once (prevents duplicate bindings across popups)
            if (!window.__ctAddCodeClickBound)
            {
                window.__ctAddCodeClickBound = true;

                $(document)
                    .off("click.ct", ".cachetur-add-code")
                    .on("click.ct", ".cachetur-add-code", function (evt)
                    {
                        evt.stopImmediatePropagation();
                        evt.preventDefault();

                        const tur = $("#cachetur-tur-valg").val();
                        const $btn = $(this);
                        const code = String($btn.data("code") || "").toUpperCase();

                        ctApiCall("planlagt_add_codes",
                        {
                            tur: tur,
                            code: code
                        }, function (data)
                        {
                            if (data === "Ok")
                            {
                                _ctCodesAdded.push(code);
                                ctUpdateAddImage(true);
                                $("#cachetur-tur-antall").html(_ctCodesAdded.length);

                                // Refresh the Cachetur header/select/count immediately (no page reload)
                                try
                                {
                                    ctCreateTripList();
                                }
                                catch (e)
                                {
                                    console.warn("[Cachetur] ctCreateTripList refresh failed:", e);
                                }
                            }
                            else
                            {
                                // Show error state on the button icon
                                $btn.attr("src", "https://cachetur.no/api/img/cachetur-15-error.png");
                            }
                        });

                        GM_setValue("cachetur_last_action", Date.now());
                    });
            }
        }

        function ctAddToCoordInfoLink(code)
        {
            if (!code || !code.length) return;

            // Extract GC code from element text or coord.info href
            function extractGcCode($el)
            {
                try
                {
                    if ($el.is("a[href*='//coord.info/']"))
                    {
                        const href = String($el.attr("href") || "");
                        return href.split("/").pop().trim().toUpperCase();
                    }
                    const txt = ($el.text() || $el.html() || "").trim();
                    const m = txt.match(/GC[A-Z0-9]+/i);
                    return (m ? m[0] : txt).toUpperCase();
                }
                catch (_)
                {
                    return "";
                }
            }

            // Find a stable root for the popup (varies across views)
            function findRoot($from)
            {
                return $from.closest(".map-item, #gmCacheInfo, .geotour-cache-info, #box, .leaflet-popup-content");
            }

            // Insert AFTER the last ".links Clear" if present; otherwise after heading or at the end
            function insertAfterLinks($root, html)
            {
                if (!$root || !$root.length) return;

                // Remove stale controls (popups often reuse DOM)
                $root.find("> .cachetur-controls-container, .links.Clear > .cachetur-controls-container").remove();

                const $lastLinks = $root.find("> .links.Clear").last();
                if ($lastLinks.length)
                {
                    $lastLinks.after(html);
                    return;
                }

                const $heading = $root.find("> h3, > h4").last();
                if ($heading.length)
                {
                    $heading.after(html);
                    return;
                }

                $root.append(html);
            }

            const gcCode = extractGcCode(code);
            if (!gcCode) return;

            if (_ctPage === "gc_map")
            {
                // === Revert to 3.5.1.4 behaviour for classic browse map ===
                // 1) Place our control as a new ".links Clear" block inside the map-item (same spot as 3.5.1.4)
                const $root = findRoot(code);
                if (!$root || !$root.length) return;

                // Clean old control (same as 3.5.1.4 did implicitly by re-render)
                $root.find(".cachetur-controls-container").remove();

                const html =
                    '<div class="links Clear cachetur-controls-container">' +
                    '<a href="#" class="cachetur-add-code" style="cursor:pointer;" data-code="' + gcCode + '">' +
                    '<img src="https://cachetur.no/api/img/cachetur-15.png" /> ' + i18next.t("send") +
                    '</a>' +
                    '</div>';

                // Append (3.5.1.4 used "code.parent().append(...)" which resolved to the same map-item container)
                $root.append(html);

                // 2) Bind a DIRECT click handler like 3.5.1.4 (avoid relying on delegated bubbling)
                const $btn = $root.find(".cachetur-controls-container .cachetur-add-code");
                $btn.off("click.ctaMap").on("click.ctaMap", function (evt)
                {
                    evt.preventDefault();
                    evt.stopImmediatePropagation();

                    const tur = $("#cachetur-tur-valg").val();
                    const $self = $(this);
                    const gc = String($self.data("code") || "").toUpperCase();

                    // Basic busy guard to avoid double-send on rapid clicks
                    if ($self.data("ctaBusy")) return false;
                    $self.data("ctaBusy", true);

                    ctApiCall("planlagt_add_codes",
                    {
                        tur: tur,
                        code: gc
                    }, function (res)
                    {
                        // Accept both legacy "Ok" and object {ok:true}
                        const success = (res === "Ok") || (res && res.ok === true);

                        if (success)
                        {
                            _ctCodesAdded.push(gc);
                            ctUpdateAddImage(true);
                            $("#cachetur-tur-antall").html(_ctCodesAdded.length);
                        }
                        else
                        {
                            // Keep the old visual error for gc_map (as in 3.5.1.4)
                            $self.html('<img src="https://cachetur.no/api/img/cachetur-15-error.png" /> ' + i18next.t("send"));
                        }

                        // Release lock shortly after response
                        setTimeout(() => $self.data("ctaBusy", false), 600);
                    });

                    GM_setValue("cachetur_last_action", Date.now());
                    return false;
                });

                // Update icon to reflect current state
                ctUpdateAddImage();
                return; // leave all other pages untouched

            }
            else if (_ctPage === "gc_geocache")
            {
                // Cache details page (unchanged)
                ctGetPublicLists(gcCode);
                $(".CacheDetailNavigation").append(
                    '<ul id="cachetur-controls-container"><li>' +
                    '<a href class="cachetur-add-code" style="cursor:pointer;" data-code="' + gcCode + '">' +
                    i18next.t("send") + '</a></li></ul>'
                );

            }
            else if (_ctPage === "gc_gctour")
            {
                // Geotour: place control as the last child of #box (fallback to root if #box is missing)
                const $root = findRoot(code);
                if (!$root || !$root.length) return;

                // Prefer #box if present
                const $host = $root.find("#box").first().length ? $root.find("#box").first() : $root;

                // Remove any previous Cachetur controls (popup DOM is often reused)
                $host.find("> .cachetur-controls-container, .links.Clear > .cachetur-controls-container").remove();

                // Build control (button avoids anchor default navigation/refresh)
                const html =
                    '<div class="links Clear cachetur-controls-container">' +
                    '<button type="button" class="cachetur-add-code" ' +
                    'style="cursor:pointer; background:none; border:none; padding:0;" ' +
                    'data-code="' + gcCode + '">' +
                    '<img src="https://cachetur.no/api/img/cachetur-15.png" /> ' + i18next.t("send") +
                    '</button>' +
                    '</div>';

                // Always append as last child of #box (or root fallback)
                $host.append(html);

                // Direct click binding (not dependent on delegated bubbling)
                const $btn = $host.find(".cachetur-controls-container .cachetur-add-code");
                $btn.off("click.ctaGctour").on("click.ctaGctour", function (evt)
                {
                    evt.preventDefault();
                    evt.stopImmediatePropagation();

                    const tur = $("#cachetur-tur-valg").val();
                    const $self = $(this);
                    const gc = String($self.data("code") || "").toUpperCase();

                    // Simple in-flight guard
                    if ($self.data("ctaBusy")) return false;
                    $self.data("ctaBusy", true);

                    ctApiCall("planlagt_add_codes",
                    {
                        tur: tur,
                        code: gc
                    }, function (res)
                    {
                        const success = (res === "Ok") || (res && res.ok === true);
                        if (success)
                        {
                            _ctCodesAdded.push(gc);
                            ctUpdateAddImage(true);
                            $("#cachetur-tur-antall").html(_ctCodesAdded.length);
                        }
                        else
                        {
                            // Use same error visual as gc_map/gctour
                            $self.html('<img src="https://cachetur.no/api/img/cachetur-15-error.png" /> ' + i18next.t("send"));
                        }
                        setTimeout(() => $self.data("ctaBusy", false), 600);
                    });

                    GM_setValue("cachetur_last_action", Date.now());
                    return false;
                });

                // Refresh UI state/icons
                ctUpdateAddImage();


            }
            else if (_ctPage === "pgc_map")
            {
                // Project-GC (unchanged)
                const $root = findRoot(code);
                insertAfterLinks($root,
                    '<div class="links Clear cachetur-controls-container">' +
                    '<a href="#" class="cachetur-add-code" style="cursor:pointer;" data-code="' + gcCode + '">' +
                    '<img src="https://cachetur.no/api/img/cachetur-15.png" /> ' + i18next.t("send") +
                    '</a>' +
                    '</div>'
                );
                ctUpdateAddImage();

            }
            else if (_ctPage === "pgc_map2")
            {
                // Project-GC (unchanged)
                const $root = findRoot(code);
                insertAfterLinks($root,
                    '<div class="links Clear cachetur-controls-container">' +
                    '<a href="#" class="cachetur-add-code" style="cursor:pointer;" data-code="' + gcCode + '">' +
                    '<img src="https://cachetur.no/api/img/cachetur-15.png" /> ' + i18next.t("send") +
                    '</a>' +
                    '</div>'
                );
                ctUpdateAddImage();

            }
            else if (_ctPage === "gc_map_new")
            {
                // New GC map (unchanged)
                $(".cache-preview-action-menu").prepend(
                    '<br><ul id="cachetur-controls-container"><li>' +
                    '<img src="https://cachetur.no/api/img/cachetur-15.png" />' +
                    '<a href class="cachetur-add-code" style="cursor:pointer;" data-code="' + gcCode + '"> ' +
                    i18next.t("send") + '</a></li></ul>'
                );
                ctGetPublicLists_gc_map_new(gcCode);
                tvinfostart();
                ctUpdateAddImage();

            }
            else
            {
                // Fallback (unchanged)
                const img =
                    '<img src="https://cachetur.no/api/img/cachetur-15.png" title="' + i18next.t("send") + '" ' +
                    'class="cachetur-add-code" style="cursor:pointer;" data-code="' + gcCode + '" /> ';
                code.prepend(img);
                ctUpdateAddImage();
            }

            // Keep the global delegated handler as a safety net for other pages/new nodes
            if (!window.__ctAddCodeClickBound)
            {
                window.__ctAddCodeClickBound = true;
                $(document)
                    .off("click.cacheturAddCode")
                    .on("click.cacheturAddCode", ".cachetur-add-code", function (evt)
                    {
                        // Only use the delegated path if no direct handler is bound
                        const $self = $(this);
                        const hasDirect = $._data(this, "events")?.click?.some(h => h.namespace === "ctaMap");
                        if (hasDirect) return; // gc_map uses direct binding

                        evt.preventDefault();
                        evt.stopImmediatePropagation();

                        const tur = $("#cachetur-tur-valg").val();
                        const gc = String($self.data("code") || "").toUpperCase();

                        ctApiCall("planlagt_add_codes",
                        {
                            tur: tur,
                            code: gc
                        }, function (res)
                        {
                            const success = (res === "Ok") || (res && res.ok === true);
                            if (success)
                            {
                                _ctCodesAdded.push(gc);
                                ctUpdateAddImage(true);
                                $("#cachetur-tur-antall").html(_ctCodesAdded.length);
                            }
                            else
                            {
                                if (_ctPage === "gc_geocache" || _ctPage === "gc_map_new")
                                {
                                    $self.addClass("cachetur-add-code-error").text(i18next.t("send"));
                                }
                                else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
                                {
                                    $self.html('<img src="https://cachetur.no/api/img/cachetur-15-error.png" /> ' + i18next.t("send"));
                                }
                                else
                                {
                                    $self.attr("src", "https://cachetur.no/api/img/cachetur-15-error.png");
                                }
                            }
                        });

                        GM_setValue("cachetur_last_action", Date.now());
                        return false;
                    });
            }
        }

        //fake update posted coordinates
        function updatecoord()
        {
            var existCondition = setInterval(function ()
            {
                if ($('#cachetur-tur-valg').length)
                {
                    clearInterval(existCondition);
                    if (_ctPage === "gc_geocache")
                    {
                        $('.LocationData').append('<span class="cachetur-header" span id="copy"> <button id="cp_btn" title="' + i18next.t('corrected.title') + '"><img src="https://raw.githubusercontent.com/cghove/bobil/main/l1515.png">' + i18next.t('corrected.button') + '<img src="https://raw.githubusercontent.com/cghove/bobil/main/1515.png"></button> </span>');
                        document.getElementById("cp_btn").addEventListener("click", clipboard);

                        function clipboard()
                        {
                            event.preventDefault();
                            var text = $("#uxLatLon").text()
                            var $temp = $("<input>");
                            $("body").append($temp);
                            $temp.val(text).select();
                            document.execCommand("copy");
                            $temp.remove();
                            $("#uxLatLon").trigger("click");
                            waitForKeyElements("#newCoordinates", function ()
                            {
                                $('#newCoordinates').val(text);
                                $(".btn-cc-parse").trigger("click");
                            });


                        }
                    };
                }
            }, 100);
        }


        //end fake update posted coordinates

        function ctAddSendPgcVgpsButton()
        {
            let container = $("#vgps_newList").parent();
            container.append('<button  type="button" class="btn btn-default btn-xs cachetur-send-vgps"><img src="https://cachetur.no/api/img/cachetur-15.png" title="' + i18next.t('send') + '" style="cursor: pointer;" /> ' + i18next.t('vgps.sendmarked') + '</button> ');
            container.append('<button  type="button" class="btn btn-default btn-xs cachetur-select-vgps"><img src="https://cachetur.no/api/img/cachetur-15.png" title="' + i18next.t('vgps.markfromtrip') + '" style="cursor: pointer;" /> ' + i18next.t('vgps.markfromtrip') + '</button> ');

            $(".cachetur-send-vgps").click(function (evt)
            {
                evt.stopImmediatePropagation();
                evt.preventDefault();

                ctPGCSendVGPSSelected();
            });

            $(".cachetur-select-vgps").click(function (evt)
            {
                evt.stopImmediatePropagation();
                evt.preventDefault();

                ctPGCSelectVGPS();
            });
        }

        function ctPGCSendVGPSSelected()
        {
            let selected = $("#vgpsTable").find(".jqgrow.ui-row-ltr.ui-widget-content.ui-state-highlight").find("[aria-describedby*='vgpsTable_gccode']").find("a").toArray();

            if (selected.length === 0)
            {
                return;
            }

            let tur = $("#cachetur-tur-valg").val();
            let codes = [];
            selected.forEach(function (item)
            {
                codes.push(item.text);
            });

            ctApiCall("planlagt_add_codes",
            {
                tur: tur,
                code: codes
            }, function (data)
            {
                if (data === "Ok")
                {
                    ctGetAddedCodes(tur);
                    ctGetTripRoute(tur);
                    alert(i18next.t('vgps.sent'));
                }
                else
                {
                    alert(i18next.t('vgps.error'));
                }
            });

            GM_setValue("cachetur_last_action", Date.now());
        }

        function ctPGCSelectVGPS()
        {
            let inCachetur = $('.cachetur-pgc-added').closest('tr').toArray();

            if (inCachetur.length === 0)
            {
                return;
            }

            inCachetur.forEach(function (item)
            {
                $('#jqg_vgpsTable_' + item.id).prop('checked', true).trigger('click');
            });
        }

        function ctPGCMarkFound()
        {
            // Run on both PGC Live Map and other Tools maps that use Leaflet
            if (_ctPage !== "pgc_map" && _ctPage !== "pgc_map2") return;

            const map = ctGetUnsafeLeafletObject();
            if (!map)
            {
                console.warn("[Cachetur] ctPGCMarkFound: Leaflet map not found");
                return;
            }

            // Iterate over all layers and apply marker logic
            map.eachLayer(function (layer)
            {
                try
                {
                    ctPGCCheckAndMarkLayer(layer);
                }
                catch (err)
                {
                    console.error("[Cachetur] ctPGCMarkFound: error while marking layer:", err);
                }
            });
        }


        function ctPGCCheckAndMarkLayer(layer)
        {
            let realLayer = layer.layer ? layer.layer : layer;

            if (realLayer instanceof L.Marker && realLayer.label)
            {
                let cacheCode = realLayer.label._content.split(" - ")[0];
                if (ctCodeAlreadyAdded(cacheCode))
                {
                    realLayer._icon.classList.add("cachetur-marker-added");
                }
                else
                {
                    realLayer._icon.classList.remove("cachetur-marker-added");
                }
            }
        }


        function ctPGCCheckVgps()
        {
            if (_ctPage !== "pgc_vgps") return;

            $(".cachetur-pgc-added").remove();

            $("#vgpsTable").find(".jqgrow.ui-row-ltr.ui-widget-content").each(function ()
            {
                let code = $(this).find("[aria-describedby*='vgpsTable_gccode']").find("a").html();
                if (ctCodeAlreadyAdded(code))
                {
                    $(this).find("[aria-describedby*='vgpsTable_name']").prepend('<img class="cachetur-pgc-added" src="https://cachetur.no/api/img/cachetur-15-success.png" title="' + i18next.t('sent') + '"> ');
                }
            });
        }

        function ctAddSendListButton()
        {
            waitForKeyElements(".actions", function ()
            {
                console.log("Injecting send to cachetur button");
                $(".actions").append('<button type="button" class="cachetur-send-bmlist gc-button multi-select-action-bar-button gc-button-has-type gc-button-primary" style="margin-left: 5px;"><img src="https://cachetur.no/api/img/cachetur-15.png" title="' + i18next.t('send') + '" style="cursor: pointer;" /> ' + i18next.t('vgps.sendmarked') + '</button>');

                $(".cachetur-send-bmlist").click(function (evt)
                {
                    evt.stopImmediatePropagation();
                    evt.preventDefault();
                    ctListSendSelected();
                });
            });
        }

        function ctListSendSelected()
        {
            if (_ctPage === "gc_bmlist")
            {
                console.log("Sending selected geocaches from gc_bmlist");
                let selected = $('.list-details-table tbody tr input[type="checkbox"]:checked');

                if (selected.length > 0)
                {
                    let codes = [];
                    let names = []; // Array to hold the names of the geocaches

                    selected.each(function ()
                    {
                        let code = $(this).closest("tr").find(".geocache-meta span").last().text().trim();
                        codes.push(code);

                        // Extract the geocache name from the anchor tag
                        let name = $(this).closest("tr").find("a.text-grey-600").text().trim();
                        names.push(name); // Add the name to the names array
                    });

                    let tur = $("#cachetur-tur-valg").val();

                    ctApiCall("planlagt_add_codes",
                    {
                        tur: tur,
                        code: codes
                    }, function (data)
                    {
                        if (data === "Ok")
                        {
                            ctGetAddedCodes(tur);
                            ctGetTripRoute(tur);

                            // Create a string of names to include in the alert
                            let namesString = names.join(", "); // Join names with a comma
                            alert(i18next.t('vgps.sent') + ": " + namesString); // Include names in the alert

                            // Update the UI to reflect the sent status
                            selected.each(function ()
                            {
                                let code = $(this).closest("tr").find(".geocache-meta span").last().text().trim();
                                let correspondingRow = $(".list-details-table tbody tr").filter(function ()
                                {
                                    return $(this).find(".geocache-meta span").last().text().trim() === code;
                                });

                                if (correspondingRow.length)
                                {
                                    correspondingRow.find(".sent-status").remove(); // Remove any existing status
                                    correspondingRow.find("td.geocache-details").append('<span class="sent-status" style="color: green;"> - Sent</span>');
                                }
                            });
                        }
                        else
                        {
                            alert(i18next.t('vgps.error'));
                        }
                    });

                    GM_setValue("cachetur_last_action", Date.now());
                }
            }
        }

        function ctCheckList()
        {
            if (_ctPage !== "gc_bmlist") return;

            waitForKeyElements(".list-details-table", function ()
            {
                console.log("Checking list for added caches");
                $(".cachetur-bmlist-added").remove(); // Remove existing indicators

                $("table.list-details-table").find("tr").each(function ()
                {
                    let codeInfo = $(this).find(".geocache-meta span").last().text().trim();
                    if (ctCodeAlreadyAdded(codeInfo))
                    {
                        $(this).find(".geocache-meta").prepend('<img class="cachetur-bmlist-added" src="https://cachetur.no/api/img/cachetur-15-success.png" title="' + i18next.t('sent') + '"> ');
                    }
                });
            });
        }

        function ctUpdateAddImage(codeAddedTo)
        {
            // Update all "send to cachetur" controls in the current popup(s)
            const imgs = $(".cachetur-add-code");
            if (imgs.length <= 0) return;

            imgs.each(function ()
            {
                const img = $(this);
                const code = img.data("code");

                // Added just now OR previously added
                const codeIsAdded = codeAddedTo === code || ctCodeAlreadyAdded(code);

                // Keep existing behavior (e.g., found-by text on GC pages)
                ctSetIconForCode(code);

                // ---------- PGC: ensure a dedicated toolbar row placed BELOW vGPS ----------
                if (_ctPage === "pgc_map" || _ctPage === "pgc_map2")
                {
                    const content = img.closest('.leaflet-popup-content');
                    const vgpsBr = content.find('.addtovgps').first().next('br');

                    // Create/find toolbar row
                    let toolbar = content.find(".cachetur-pgc-toolbar");
                    if (toolbar.length === 0)
                    {
                        toolbar = $('<div class="cachetur-pgc-toolbar" ' +
                            'style="display:block; clear:both; position:relative; height:18px; margin-top:4px; z-index:2;"></div>');
                        if (vgpsBr.length) vgpsBr.after(toolbar);
                        else toolbar.insertBefore(img);
                    }

                    // Move the "send" icon into the toolbar and position it (left: 20px)
                    toolbar.append(img);
                    img.css(
                    {
                        position: "absolute",
                        top: 0,
                        left: "20px",
                        cursor: "pointer",
                        zIndex: 2
                    });
                    img.attr("title", codeIsAdded ? i18next.t('sent') : i18next.t('send'));
                    img.attr("src", codeIsAdded ?
                        "https://cachetur.no/api/img/cachetur-15-success.png" :
                        "https://cachetur.no/api/img/cachetur-15.png");

                    // If added → ensure comment + priorities exist (idempotent)
                    if (codeIsAdded)
                    {
                        // Comment icon (left: 60px)
                        if (toolbar.find('.cachetur-add-comment[data-code="' + code + '"]').length === 0)
                        {
                            const commentControl = $(
                                '<img src="https://cachetur.no/api/img/cachetur-comment.png" ' +
                                ' data-code="' + code + '" title="' + i18next.t('comments.add') + '" ' +
                                ' class="cachetur-add-comment" ' +
                                ' style="position:absolute; top:0; left:60px; cursor:pointer; z-index:2;" />'
                            );
                            toolbar.append(commentControl);

                            // Dedicated click handler for PGC image button
                            commentControl.on("click", function (evt)
                            {
                                // Prevent closing of Leaflet popup and default behavior
                                evt.stopImmediatePropagation();
                                evt.preventDefault();

                                const tur = $("#cachetur-tur-valg").val();
                                const commentImg = $(this);
                                const commentCode = commentImg.data("code");
                                const comment = prompt(i18next.t('comments.description'));
                                if (comment == null) return false; // User cancelled

                                ctApiCall("planlagt_add_code_comment",
                                {
                                    tur: tur,
                                    code: commentCode,
                                    comment: comment
                                }, function (data)
                                {
                                    if (data === "Ok" || (data && data.ok === true))
                                    {
                                        commentImg.attr("src", "https://cachetur.no/api/img/cachetur-comment-success.png")
                                            .attr("title", i18next.t('comments.saved'));
                                    }
                                    else
                                    {
                                        commentImg.attr("src", "https://cachetur.no/api/img/cachetur-comment-error.png")
                                            .attr("title", i18next.t('comments.error'));
                                    }
                                });

                                try
                                {
                                    GM_setValue("cachetur_last_action", Date.now());
                                }
                                catch (_)
                                {}
                                return false;
                            });
                        }

                        // Priority icons only for non-template trips (ID NOT ending with 'T')
                        if (!$("#cachetur-tur-valg").val().endsWith('T'))
                        {
                            if (toolbar.find('.cachetur-set-pri-1[data-code="' + code + '"]').length === 0) ctCreatePriorityControl(img, code, 1);
                            if (toolbar.find('.cachetur-set-pri-2[data-code="' + code + '"]').length === 0) ctCreatePriorityControl(img, code, 2);
                            if (toolbar.find('.cachetur-set-pri-3[data-code="' + code + '"]').length === 0) ctCreatePriorityControl(img, code, 3);
                        }
                    }
                    else
                    {
                        // Not added → keep only the send icon inside the toolbar on PGC
                        const toolbarParent = img.parent();
                        toolbarParent.find('.cachetur-add-comment, .cachetur-set-pri-1, .cachetur-set-pri-2, .cachetur-set-pri-3').remove();
                    }

                    // Do NOT return; geocaching.com branches below should still execute for their pages
                }
                // ---------- /PGC toolbar handling ----------

                if (codeIsAdded)
                {
                    if (_ctPage === "gc_geocache")
                    {
                        img.removeClass("cachetur-add-code-error");
                        img.addClass("cachetur-add-code-success");
                        img.html(i18next.t('sent'));
                    }
                    else if (_ctPage === "gc_map_new")
                    {
                        img.html('<img src="https://cachetur.no/api/img/cachetur-15-success.png" /> ' + i18next.t('sent'));
                    }
                    else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
                    {
                        img.html('<img src="https://cachetur.no/api/img/cachetur-15-success.png" /> ' + i18next.t('sent'));
                    }
                    else
                    {
                        // PGC handled above; keep as-is here for other IMG-only pages
                        img.attr("src", "https://cachetur.no/api/img/cachetur-15-success.png");
                        img.attr("title", i18next.t('sent'));
                    }

                    // Only create GC comment/priority controls on GC pages (PGC handled above)
                    if (_ctPage === "gc_geocache")
                    {
                        if ($("#cachetur-controls-container .cachetur-add-comment[data-code='" + code + "']").length === 0)
                        {
                            const li = $('<li></li>');
                            // Use href="#" to avoid navigation; delegated handler will catch clicks
                            const commentControl = $('<a href="#" class="cachetur-add-comment" data-code="' + code + '">' + i18next.t('comments.add') + '</a>');
                            li.append(commentControl);
                            $("#cachetur-controls-container").append(li);
                        }
                        if (!$("#cachetur-tur-valg").val().endsWith('T'))
                        {
                            ctCreatePriorityControl(img, code, 1);
                            ctCreatePriorityControl(img, code, 2);
                            ctCreatePriorityControl(img, code, 3);
                        }
                    }
                    else if (_ctPage === "gc_map_new")
                    {
                        if ($("#cachetur-controls-container .cachetur-add-comment[data-code='" + code + "']").length === 0)
                        {
                            const li = $('<li></li>');
                            const commentControl = $('<a href="#" class="cachetur-add-comment" data-code="' + code + '"><img src="https://cachetur.no/api/img/cachetur-comment.png" /> ' + i18next.t('comments.add') + ' </a>');
                            li.append(commentControl);
                            $("#cachetur-controls-container").append(li);
                        }
                        if (!$("#cachetur-tur-valg").val().endsWith('T'))
                        {
                            ctCreatePriorityControl(img, code, 1);
                            ctCreatePriorityControl(img, code, 2);
                            ctCreatePriorityControl(img, code, 3);
                        }
                    }
                    else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
                    {
                        if (img.parent().find(".cachetur-add-comment[data-code='" + code + "']").length === 0)
                        {
                            const commentControl = $('<a href="#" class="cachetur-add-comment" data-code="' + code + '"><img src="https://cachetur.no/api/img/cachetur-comment.png" /> ' + i18next.t('comments.add') + ' </a>');
                            img.parent().append(commentControl);

                            // IMPORTANT: bind a direct click handler here (popup may live in another document)
                            commentControl.on("click", function (evt)
                            {
                                // Prevent default navigation and stop bubbling to Leaflet
                                evt.preventDefault();
                                evt.stopImmediatePropagation();

                                const $link = $(this);
                                const commentCode = String($link.data("code") || "").toUpperCase();
                                const tur = $("#cachetur-tur-valg").val();

                                const comment = prompt(i18next.t("comments.description"));
                                if (comment == null) return false; // User cancelled

                                ctApiCall("planlagt_add_code_comment",
                                {
                                    tur: tur,
                                    code: commentCode,
                                    comment: comment
                                }, function (res)
                                {
                                    const ok = (res === "Ok") || (res && res.ok === true);
                                    $link.html(
                                        '<img src="https://cachetur.no/api/img/cachetur-comment' +
                                        (ok ? '-success' : '-error') + '.png" /> ' +
                                        i18next.t(ok ? "comments.saved" : "comments.error")
                                    );
                                });

                                try
                                {
                                    GM_setValue("cachetur_last_action", Date.now());
                                }
                                catch (_)
                                {}
                                return false;
                            });
                        }
                        if (!$("#cachetur-tur-valg").val().endsWith('T'))
                        {
                            ctCreatePriorityControl(img, code, 1);
                            ctCreatePriorityControl(img, code, 2);
                            ctCreatePriorityControl(img, code, 3);
                        }
                    }
                }
                else
                {
                    if (_ctPage === "gc_geocache")
                    {
                        img.removeClass("cachetur-add-code-success").removeClass("cachetur-add-code-error").html(i18next.t('send'));
                        img.parent().parent().find(".cachetur-add-comment").parent().remove();
                        img.parent().parent().find(".cachetur-set-pri-1").parent().remove();
                        img.parent().parent().find(".cachetur-set-pri-2").parent().remove();
                        img.parent().parent().find(".cachetur-set-pri-3").parent().remove();
                        $("#cachetur-found-by-container").remove();
                    }
                    else if (_ctPage === "gc_map_new")
                    {
                        img.removeClass("cachetur-add-code-success").removeClass("cachetur-add-code-error").html(i18next.t('send'));
                        img.parent().parent().find(".cachetur-add-comment").parent().remove();
                        img.parent().parent().find(".cachetur-set-pri-1").parent().remove();
                        img.parent().parent().find(".cachetur-set-pri-2").parent().remove();
                        img.parent().parent().find(".cachetur-set-pri-3").parent().remove();
                    }
                    else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
                    {
                        img.html('<img src="https://cachetur.no/api/img/cachetur-15.png" /> ' + i18next.t('send'));
                        img.parent().find(".cachetur-add-comment, .cachetur-set-pri-1, .cachetur-set-pri-2, .cachetur-set-pri-3, .cachetur-found-by").remove();
                    }
                    else
                    {
                        // PGC: already removed extras above; ensure default send icon
                        img.attr("src", "https://cachetur.no/api/img/cachetur-15.png").attr("title", i18next.t('send'));
                        img.parent().find(".cachetur-found-by").remove();
                    }
                }
            });

            // ---------- One-time delegated handler for GC comment links (works for same-document popups) ----------
            // On gc_map, popup may live in a different document; we also bind direct handlers above when creating the link.
            if (!window.__ctAddCommentBound)
            {
                window.__ctAddCommentBound = true;

                $(document)
                    .off("click.cacheturAddComment")
                    .on("click.cacheturAddComment", ".cachetur-add-comment", function (evt)
                    {
                        // Prevent default navigation and stop bubbling to Leaflet
                        evt.preventDefault();
                        evt.stopImmediatePropagation();

                        const $link = $(this);
                        const code = String($link.data("code") || "").toUpperCase();
                        const tur = $("#cachetur-tur-valg").val();

                        const comment = prompt(i18next.t("comments.description"));
                        if (comment == null) return false; // User cancelled

                        ctApiCall("planlagt_add_code_comment",
                        {
                            tur: tur,
                            code: code,
                            comment: comment
                        }, function (res)
                        {
                            const ok = (res === "Ok") || (res && res.ok === true);

                            // Visual feedback depending on current GC page
                            if (_ctPage === "gc_geocache" || _ctPage === "gc_map_new")
                            {
                                $link.text(i18next.t(ok ? "comments.saved" : "comments.error"));
                            }
                            else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
                            {
                                $link.html(
                                    '<img src="https://cachetur.no/api/img/cachetur-comment' +
                                    (ok ? '-success' : '-error') + '.png" /> ' +
                                    i18next.t(ok ? "comments.saved" : "comments.error")
                                );
                            }
                            else
                            {
                                // Fallback
                                $link.attr("title", i18next.t(ok ? "comments.saved" : "comments.error"));
                            }
                        });

                        try
                        {
                            GM_setValue("cachetur_last_action", Date.now());
                        }
                        catch (_)
                        {}
                        return false;
                    });
            }
        }

        function ctCreatePriorityControl(img, code, priority)
        {
            let control;

            if (_ctPage === "gc_geocache")
            {
                // GC cache page: use the controls container and avoid duplicates
                const container = $("#cachetur-controls-container");
                const selector = '.cachetur-set-pri-' + priority + '[data-code="' + code + '"]';
                if (container.find(selector).length > 0) return;

                const li = $('<li></li>');
                control = $('<a href class="cachetur-set-pri-' + priority + '" data-code="' + code + '">' +
                    i18next.t('priority.set' + priority) + '</a>');
                li.append(control);
                container.append(li);

            }
            else if (_ctPage === "gc_map_new")
            {
                // GC new/live map: use the controls container and avoid duplicates
                const container = $("#cachetur-controls-container");
                const selector = '.cachetur-set-pri-' + priority + '[data-code="' + code + '"]';
                if (container.find(selector).length > 0) return;

                const li = $('<li></li>').insertAfter(".cachetur-add-comment");
                control = $('<a href class="cachetur-set-pri-' + priority + '" data-code="' + code + '">' +
                    '<img src="https://cachetur.no/api/img/p' + priority + '.png" /> ' +
                    i18next.t('priority.set' + priority) + '</a>');
                li.append(control);
                container.append(li);

            }
            else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
            {
                // GC classic map / GCTour: append next to the "sent" label and avoid duplicates
                const container = img.parent(); // same parent as the "sent" link
                const selector = '.cachetur-set-pri-' + priority + '[data-code="' + code + '"]';
                if (container.find(selector).length > 0) return;

                control = $('<a href class="cachetur-set-pri-' + priority + '" data-code="' + code + '">' +
                    '<img src="https://cachetur.no/api/img/p' + priority + '.png" /> ' +
                    i18next.t('priority.set' + priority) + '</a>');
                container.append(control);

            }
            else
            {
                // PGC: add to the toolbar (row 1) at 80/100/120px; avoid duplicates
                let toolbar = img.parent(); // on PGC, img.parent() should already be the toolbar
                if (!toolbar.hasClass('cachetur-pgc-toolbar'))
                {
                    // Fallback: create toolbar below vGPS if missing, then move img into it
                    const content = img.closest('.leaflet-popup-content');
                    const vgpsBr = content.find('.addtovgps').first().next('br');
                    toolbar = $('<div class="cachetur-pgc-toolbar" ' +
                        'style="display:block; clear:both; position:relative; height:18px; margin-top:4px; z-index:2;"></div>');
                    if (vgpsBr.length) vgpsBr.after(toolbar);
                    else toolbar.insertBefore(img);
                    toolbar.append(img);
                    img.css(
                    {
                        position: "absolute",
                        top: 0,
                        left: "20px",
                        cursor: "pointer",
                        zIndex: 2
                    });
                }

                const selector = '.cachetur-set-pri-' + priority + '[data-code="' + code + '"]';
                if (toolbar.find(selector).length > 0) return;

                const left = 60 + priority * 20; // p1=80, p2=100, p3=120
                control = $('<img src="https://cachetur.no/api/img/p' + priority + '.png" data-code="' + code + '"' +
                    ' title="' + i18next.t('priority.set' + priority) + '" class="cachetur-set-pri-' + priority + '"' +
                    ' style="position:absolute; top:0; left:' + left + 'px; cursor:pointer; z-index:2;" />');
                toolbar.append(control);
            }

            // Click handler (unchanged semantics)
            control.click(function (evt)
            {
                evt.stopImmediatePropagation();
                evt.preventDefault();

                const tur = $("#cachetur-tur-valg").val();
                const priorityImg = $(this);
                const priorityCode = priorityImg.data('code');

                ctApiCall("planlagt_set_code_priority",
                {
                    tur: tur,
                    code: priorityCode,
                    priority: priority
                }, function (data)
                {
                    if (data === "Ok")
                    {
                        if (_ctPage === "gc_geocache" || _ctPage === "gc_map_new")
                        {
                            priorityImg.addClass("cachetur-set-pri-" + priority + "-success").html(i18next.t('priority.saved'));
                        }
                        else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
                        {
                            priorityImg.html('<img src="https://cachetur.no/api/img/p' + priority + '_success.png" /> ' + i18next.t('priority.saved'));
                        }
                        else
                        {
                            priorityImg.attr("src", "https://cachetur.no/api/img/p" + priority + "_success.png")
                                .attr("title", i18next.t('priority.saved'));
                        }
                    }
                    else
                    {
                        if (_ctPage === "gc_geocache" || _ctPage === "gc_map_new")
                        {
                            priorityImg.addClass("cachetur-set-pri-" + priority + "-error").html(i18next.t('priority.error'));
                        }
                        else if (_ctPage === "gc_map" || _ctPage === "gc_gctour")
                        {
                            priorityImg.html('<img src="https://cachetur.no/api/img/p' + priority + '_error.png" /> ' + i18next.t('priority.error'));
                        }
                        else
                        {
                            priorityImg.attr("src", "https://cachetur.no/api/img/p" + priority + "_error.png")
                                .attr("title", i18next.t('priority.error'));
                        }
                    }
                });

                GM_setValue("cachetur_last_action", Date.now());
            });
        }

        function ctCodeAlreadyAdded(code)
        {
            return _ctCodesAdded.indexOf(code) > -1;
        }

        function ctSetIconForCode(code)
        {
            // Query backend for "found by" info for this code in the selected trip
            const id = $("#cachetur-tur-valg").val();

            ctApiCall("planlagt_check_find",
            {
                tur: id,
                code: code
            }, function (foundBy)
            {

                if (foundBy === "") return "";

                const img = $(".cachetur-add-code[data-code='" + code + "']");
                if (img.length <= 0) return;

                // Avoid duplicates globally and per-popup
                if ($(".cachetur-found-by[data-code='" + code + "']").length > 0) return;
                const content = img.closest('.leaflet-popup-content');
                if (content.find(".cachetur-found-by-container").length > 0) return;

                // ----- Keep existing GC behavior unchanged -----
                if (_ctPage === "gc_geocache")
                {
                    $("#cachetur-found-by-container").remove();
                    $("#cachetur-controls-container").parent().append(
                        '<ul id="cachetur-found-by-container">' +
                        '<li><b><img src="https://cachetur.no/api/img/attfind.png" /> ' + i18next.t('foundby') + '</b></li>' +
                        '<li>' + foundBy + '</li>' +
                        '</ul>'
                    );
                    return;
                }
                if (_ctPage === "gc_map_new")
                {
                    $("#cachetur-found-by-container").remove();
                    $("#cachetur-controls-container").parent().append(
                        '<ul id="cachetur-found-by-container">' +
                        '<li><b><img src="https://cachetur.no/api/img/attfind.png" /> ' + i18next.t('foundby') + '</b></li>' +
                        '<li>' + foundBy + '</li>' +
                        '</ul>'
                    );
                    return;
                }
                if (_ctPage === "gc_map")
                {
                    img.closest(".map-item").find(".cachetur-found-by-container").remove();
                    img.closest(".map-item").append(
                        '<div class="links Clear cachetur-found-by-container">' +
                        '<b><img src="https://cachetur.no/api/img/attfind.png" /> ' + i18next.t('foundby') + '</b> ' + foundBy +
                        '</div>'
                    );
                    return;
                }
                // ----- /GC behavior -----

                // ----- PGC: put "Found by" on its own row BELOW the toolbar (and below vGPS) -----
                const vgpsBr = content.find('.addtovgps').first().next('br');
                const toolbar = content.find('.cachetur-pgc-toolbar').last();

                const foundLine = $(
                    '<div class="cachetur-found-by-container" ' +
                    '     style="display:block; clear:both; margin-top:4px; position:relative; z-index:2; ' +
                    '            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' +
                    '<b><img src="https://cachetur.no/api/img/attfind.png" style="vertical-align:text-bottom; margin-right:4px;" /> ' +
                    i18next.t('foundby') + '</b> ' + foundBy +
                    '</div>'
                );

                if (toolbar.length)
                {
                    foundLine.insertAfter(toolbar);
                }
                else if (vgpsBr.length)
                {
                    foundLine.insertAfter(vgpsBr);
                }
                else
                {
                    foundLine.insertAfter(img);
                }
                // ----- /PGC -----
            });
        }

        // Get url parameter.
        function getURLParam(key)
        {
            var query = window.location.search.substring(1);
            var pairs = query.split('&');
            for (let i = 0; i < pairs.length; i++)
            {
                var pair = pairs[i].split('=');
                if (pair[0] == key)
                {
                    if (pair[1].length > 0) return pair[1];
                }
            }
            return undefined;
        };

        function ctFixNewGcMapIssues()
        {
            if (window.location.href.indexOf("bm=") > -1) return;

            unsafeWindow.cacheturGCMap.on('zoomend', function ()
            {
                var latHighG = false;
                var latLowG = false;
                var lngHighG = false;
                var lngLowG = false;
                var firstRun = true;
                const ONE_MINUTE_MS = 60 * 1000;

                function searchThisArea(waitCount)
                {
                    if ($('.leaflet-gl-layer.mapboxgl-map')[0] || $('div.gm-style')[0])
                    { // Leaflet or GM
                        if (!$('.loading-container.show')[0] && !$('li.active svg.my-lists-toggle-icon')[0] && ($('#clear-map-control')[0] && firstRun))
                        {
                            setTimeout(function ()
                            {
                                if ($('.loading-container.show')[0]) return;
                                var pxHeight = window.innerHeight;
                                var pxWidth = window.innerWidth;
                                var lat = parseFloat(getURLParam('lat'));
                                var lng = parseFloat(getURLParam('lng'));
                                var zoom = parseInt(getURLParam('zoom'));
                                var metersPerPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
                                var latMeterDistance = metersPerPx * pxHeight;
                                var lngMeterDistance = metersPerPx * pxWidth;
                                var latHalfDezDistance = latMeterDistance / 1850 / 60 / 2;
                                var lngHalfDezDistance = lngMeterDistance / (1850 * Math.cos(lat * Math.PI / 180)) / 60 / 2;
                                var latHigh = (lat + latHalfDezDistance).toFixed(4);
                                var latLow = (lat - latHalfDezDistance).toFixed(4);
                                var lngHigh = (lng + lngHalfDezDistance).toFixed(4);
                                var lngLow = (lng - lngHalfDezDistance).toFixed(4);
                                if (latHighG == false || latHigh > latHighG || latLow < latLowG || lngHigh > lngHighG || lngLow < lngLowG)
                                {
                                    latHighG = latHigh;
                                    latLowG = latLow;
                                    lngHighG = lngHigh;
                                    lngLowG = lngLow;
                                    if (!firstRun)
                                    {
                                        let times = JSON.parse(GM_getValue("search_this_area_times", "[]"));
                                        if (times.length < 9)
                                        {
                                            $('#clear-map-control').click().click();
                                            times.push(Date.now());
                                            GM_setValue("search_this_area_times", JSON.stringify(times));
                                        }
                                        else
                                        {
                                            let t = Date.now();
                                            // check 1min limit
                                            if ((t - times[0]) > ONE_MINUTE_MS)
                                            {
                                                $('#clear-map-control').click().click();
                                                times.splice(0, 1);
                                                times.push(t);
                                                GM_setValue("search_this_area_times", JSON.stringify(times));
                                            }
                                            else
                                            {
                                                if ($('body.cta-waiting-msg').length === 0)
                                                {
                                                    $('body').addClass('cta-waiting-msg');
                                                    var wait = Math.ceil((ONE_MINUTE_MS - (t - times[0])) / 1000);

                                                    function countdown(waitTime)
                                                    {
                                                        if (waitTime < 1)
                                                        {
                                                            $('#cta-waiting-msg').remove();
                                                            $('div.loading-container').css('display', 'none').removeClass('show');
                                                            $('body').removeClass('cta-waiting-msg');
                                                        }
                                                        else
                                                        {
                                                            $('div.loading-container').css('display', 'flex').addClass('show');
                                                            $('#cta-waiting-msg').remove();
                                                            $('.loading-display').append('<span id="cta-waiting-msg" role="alert" aria-live="assertive">' + i18next.t('refresh.tomany ') + ' ' + +waitTime + ' ' + i18next.t(' refresh.s') + '</span>');

                                                            setTimeout(function ()
                                                            {
                                                                countdown(--waitTime);
                                                            }, 1000);
                                                        }
                                                    }
                                                    countdown(wait);
                                                }
                                            }
                                        }
                                    }
                                    firstRun = false;
                                }
                            }, 400);
                        }
                    }
                    else
                    {
                        waitCount++;
                        if (waitCount <= 200) setTimeout(function ()
                        {
                            searchThisArea(waitCount);
                        }, 50);
                    }
                }
                window.history.pushState = new Proxy(window.history.pushState,
                {
                    apply: (target, thisArg, argArray) =>
                    {
                        searchThisArea(0);
                        return target.apply(thisArg, argArray);
                    }
                });
            });

            unsafeWindow.cacheturGCMap.on("dragend", function ()
            {
                var latHighG = false;
                var latLowG = false;
                var lngHighG = false;
                var lngLowG = false;
                var firstRun = true;
                const ONE_MINUTE_MS = 60 * 1000;

                function searchThisArea(waitCount)
                {
                    if ($('.leaflet-gl-layer.mapboxgl-map')[0] || $('div.gm-style')[0])
                    { // Leaflet or GM
                        if (!$('.loading-container.show')[0] && !$('li.active svg.my-lists-toggle-icon')[0] && ($('#clear-map-control')[0] || firstRun))
                        {
                            setTimeout(function ()
                            {
                                if ($('.loading-container.show')[0]) return;
                                var pxHeight = window.innerHeight;
                                var pxWidth = window.innerWidth;
                                var lat = parseFloat(getURLParam('lat'));
                                var lng = parseFloat(getURLParam('lng'));
                                var zoom = parseInt(getURLParam('zoom'));
                                var metersPerPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
                                var latMeterDistance = metersPerPx * pxHeight;
                                var lngMeterDistance = metersPerPx * pxWidth;
                                var latHalfDezDistance = latMeterDistance / 1850 / 60 / 2;
                                var lngHalfDezDistance = lngMeterDistance / (1850 * Math.cos(lat * Math.PI / 180)) / 60 / 2;
                                var latHigh = (lat + latHalfDezDistance).toFixed(4);
                                var latLow = (lat - latHalfDezDistance).toFixed(4);
                                var lngHigh = (lng + lngHalfDezDistance).toFixed(4);
                                var lngLow = (lng - lngHalfDezDistance).toFixed(4);
                                if (latHighG == false || latHigh > latHighG || latLow < latLowG || lngHigh > lngHighG || lngLow < lngLowG)
                                {
                                    latHighG = latHigh;
                                    latLowG = latLow;
                                    lngHighG = lngHigh;
                                    lngLowG = lngLow;

                                    if (!firstRun)
                                    {
                                        let times = JSON.parse(GM_getValue("search_this_area_times", "[]"));
                                        if (times.length < 9)
                                        {
                                            $('#clear-map-control').click().click();
                                            times.push(Date.now());
                                            GM_setValue("search_this_area_times", JSON.stringify(times));
                                        }
                                        else
                                        {
                                            let t = Date.now();
                                            if ((t - times[0]) > ONE_MINUTE_MS)
                                            {
                                                $('#clear-map-control').click().click();
                                                times.splice(0, 1);
                                                times.push(t);
                                                GM_setValue("search_this_area_times", JSON.stringify(times));
                                            }
                                            else
                                            {
                                                if ($('body.cta-waiting-msg').length === 0)
                                                {
                                                    $('body').addClass('cta-waiting-msg');
                                                    var wait = Math.ceil((ONE_MINUTE_MS - (t - times[0])) / 1000);

                                                    function countdown(waitTime)
                                                    {
                                                        if (waitTime < 1)
                                                        {
                                                            $('#cta-waiting-msg').remove();
                                                            $('div.loading-container').css('display', 'none').removeClass('show');
                                                            $('body').removeClass('cta-waiting-msg');
                                                        }
                                                        else
                                                        {
                                                            $('div.loading-container').css('display', 'flex').addClass('show');
                                                            $('#cta-waiting-msg').remove();
                                                            $('.loading-display').append('<span id="cta-waiting-msg" role="alert" aria-live="assertive">' + i18next.t('refresh.tomany') + ' ' + waitTime + ' ' + i18next.t('refresh.s') + '</span>');

                                                            setTimeout(function ()
                                                            {
                                                                countdown(--waitTime);
                                                            }, 1000);
                                                        }
                                                    }
                                                    countdown(wait);
                                                }
                                            }
                                        }
                                    }
                                    firstRun = false;
                                }
                            }, 400);
                        }
                    }
                    else
                    {
                        waitCount++;
                        if (waitCount <= 200) setTimeout(function ()
                        {
                            searchThisArea(waitCount);
                        }, 50);
                    }
                }
                window.history.pushState = new Proxy(window.history.pushState,
                {
                    apply: (target, thisArg, argArray) =>
                    {
                        searchThisArea(0);
                        return target.apply(thisArg, argArray);
                    }
                });
            });
        };
        // Add D/T info on a cache page

        /*
        Fork of Geocaching - Add D/T info on a cache page.
        By Francois Crevola

        Copyright (c) 2014-2018, Francois Crevola
        All rights reserved.

        Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

        1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

        2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

        THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
        PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
        PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
        ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

        */


        // Start the DT info feature only if the 'uc3' toggle is ON
    /* [TCA2] extracted tvinfostart */
    /* [TCA2] extracted tvinfo */



    }
    console.log("[TCA2] [features/misc.js] Ready");
  } catch (e) {
    console.error("[TCA2] [features/misc.js] Error during module execution", e);
  }
})();
