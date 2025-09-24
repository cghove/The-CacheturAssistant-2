// [TCA2] features/poi.js
// This module was split from the original monolithic userscript. All logs are in English.
(function() {
  try {
    console.log("[TCA2] [features/poi.js] Loaded");

        function createCT_POI()
        {
            // Return existing singleton if already initialized
            if ((unsafeWindow?.CT_POI || window.CT_POI)?.init)
            {
                return unsafeWindow?.CT_POI || window.CT_POI;
            }

            // i18n helper for display-only text
            function tt(key, opts)
            {
                try
                {
                    return (unsafeWindow?.i18next || window?.i18next)?.t(key, opts) ?? key;
                }
                catch (_)
                {
                    return key;
                }
            }

            const CT_POI = (() =>
            {
                // Overpass backends
                const OVERPASS = [
                    "https://overpass.kumi.systems/api/interpreter",
                    "https://overpass-api.de/api/interpreter",
                    "https://overpass.osm.ch/api/interpreter",
                    "https://overpass.openstreetmap.fr/api/interpreter" // often 403; keep last
                ];
                // ---------- Tuning / debug ----------
                let MIN_ZOOM = 12;
                const DEBUG = true;
                const MOVE_DEBOUNCE_MS = 500;
                const FETCH_COOLDOWN_MS = 1500;

                // Increase per-try timeout and retries
                const OVERPASS_PER_TRY_TIMEOUT_MS = 26000; // was 9000
                const OVERPASS_MAX_RETRIES = 3; // was 2
                const REST_DEDUP_METERS = 50;


                // Generic include/exclude filters
                let FILTERS = {
                    parking:
                    {
                        include: [],
                        exclude: []
                    },
                    wildcamp:
                    {
                        include: ["wildcamp", "backcountry", "primitive", "basic"],
                        exclude: []
                    },
                    rv:
                    {
                        include: [],
                        exclude: []
                    },
                    ev:
                    {
                        include: ["charging_station"],
                        exclude: []
                    },
                    fuel:
                    {
                        include: ["fuel"],
                        exclude: []
                    },
                    terminal:
                    {
                        include: ["station", "halt", "tram_stop", "bus_station", "ferry_terminal", "aeroway", "public_transport"],
                        exclude: ["bus_stop"]
                    },
                    store:
                    {
                        include: [],
                        exclude: []
                    },
                    attraction:
                    {
                        include: ["viewpoint", "attraction", "historic", "natural", "museum", "memorial", "ruins", "monument", "battlefield", "geological", "rock", "gallery", "zoo", "aquarium", "theme_park", "planetarium", "picnic_site", "peak", "volcano"],
                        exclude: ["information", "guidepost", "map", "board"]
                    },
                    rest:
                    {
                        include: ["rest_area", "bench", "picnic_table"],
                        exclude: ["shelter"]
                    },
                    food:
                    {
                        include: [],
                        exclude: []
                    },
                    lodging:
                    {
                        include: [],
                        exclude: ["wildcamp", "backcountry", "primitive", "basic"]
                    }
                };

                // Advanced filters (controlled from the menu)
                let ADV_FILTERS = {
                    ev:
                    {
                        sockets:
                        {
                            type2: true,
                            ccs: true,
                            chademo: true,
                            schuko: false,
                            type1: false,
                            j1772: true,
                            ccs1: true,
                            nacs: true,
                            tesla_sc: false,
                            tesla_dest: false,
                            nema1450: false,
                            nema515: false,
                            nema520: false,
                            tt30: false
                        },
                        minKW: 0
                    },
                    lodging:
                    {
                        types:
                        {
                            hotel: true,
                            motel: true,
                            guest_house: true,
                            hostel: true,
                            alpine_hut: true,
                            camp_site: true,
                            caravan_site: true,
                            chalet: true
                        }
                    },
                    attraction:
                    {
                        culture:
                        {
                            museum: true,
                            artwork: true,
                            castle: true,
                            ruins: true,
                            monument: true,
                            memorial: true,
                            archaeological_site: true,
                            church: false
                        },
                        nature:
                        {
                            viewpoint: true,
                            picnic_site: false,
                            peak: false,
                            volcano: false,
                            waterfall: true,
                            cave_entrance: true
                        },
                        recreation:
                        {
                            theme_park: true,
                            zoo: true,
                            aquarium: true,
                            gallery: true,
                            planetarium: true,
                            roller_coaster: true
                        }
                    },
                    store:
                    {
                        kinds:
                        {},
                        brand: ""
                    },
                    parking:
                    {
                        free_only: false,
                        covered_only: false,
                        paved_only: false,
                        pnr_only: false,
                        min_capacity: 0,
                        motorhome_ok: false,
                        disabled_only: false,
                        maxheight_limit: 0
                    },
                    food:
                    {
                        kinds:
                        {},
                        diet:
                        {
                            vegan: false,
                            vegetarian: false
                        }
                    }
                };

                // Clustering
                let CLUSTER_ENABLE = true;
                let CLUSTER_DISABLE_AT_ZOOM = 11;
                let clusterReady = false;

                function getLeafletSemver()
                {
                    const L = getL();
                    const parts = String(L?.version || "1.0.0").split(".").map(n => parseInt(n, 10) || 0);
                    return {
                        major: parts[0],
                        minor: parts[1],
                        patch: parts[2]
                    };
                }

                function isTooOldForCluster()
                {
                    const v = getLeafletSemver();
                    return (v.major === 0 && v.minor < 7);
                }

                function ensureMarkerClusterLib()
                {
                    return new Promise((resolve) =>
                    {
                        const L = getL();
                        if (!L)
                        {
                            setTimeout(() => ensureMarkerClusterLib().then(resolve), 250);
                            return;
                        }
                        if (isTooOldForCluster())
                        {
                            console.warn("[CT_POI] Leaflet", L.version, "too old for markercluster.");
                            clusterReady = false;
                            resolve(false);
                            return;
                        }
                        if (typeof L.markerClusterGroup === "function")
                        {
                            clusterReady = true;
                            resolve(true);
                            return;
                        }

                        const base = `https://unpkg.com/leaflet.markercluster@1.5.3/dist`;
                        if (!document.querySelector('link[data-ct="mcluster-css"]'))
                        {
                            const link = document.createElement("link");
                            link.rel = "stylesheet";
                            link.href = `${base}/MarkerCluster.css`;
                            link.setAttribute("data-ct", "mcluster-css");
                            document.head.appendChild(link);
                        }
                        if (!document.querySelector('link[data-ct="mcluster-css2"]'))
                        {
                            const link2 = document.createElement("link");
                            link2.rel = "stylesheet";
                            link2.href = `${base}/MarkerCluster.Default.css`;
                            link2.setAttribute("data-ct", "mcluster-css2");
                            document.head.appendChild(link2);
                        }
                        if (!document.querySelector('script[data-ct="mcluster-js"]'))
                        {
                            const s = document.createElement("script");
                            s.src = `${base}/leaflet.markercluster.js`;
                            s.async = true;
                            s.setAttribute("data-ct", "mcluster-js");
                            s.onload = () =>
                            {
                                clusterReady = !!(getL() && typeof getL().markerClusterGroup === "function");
                                if (clusterReady) rebuildLayerGroups();
                                resolve(clusterReady);
                            };
                            s.onerror = () => resolve(false);
                            document.head.appendChild(s);
                        }
                        else
                        {
                            const tick = () =>
                            {
                                if (getL() && typeof getL().markerClusterGroup === "function")
                                {
                                    clusterReady = true;
                                    rebuildLayerGroups();
                                    resolve(true);
                                }
                                else setTimeout(tick, 150);
                            };
                            tick();
                        }
                    });
                }

                // Layer registry
                let layers = {
                    parking: null,
                    lodging: null,
                    food: null,
                    attraction: null,
                    store: null,
                    terminal: null,
                    fuel: null,
                    ev: null,
                    rv: null,
                    wildcamp: null,
                    rest: null
                };

                // Enabled flags
                let enabled = {
                    parking: false,
                    lodging: false,
                    food: false,
                    attraction: false,
                    store: false,
                    terminal: false,
                    fuel: false,
                    ev: false,
                    rv: false,
                    wildcamp: false,
                    rest: false
                };

                // State
                let map = null,
                    panesSupported = false,
                    moveTimer = null,
                    lastFetch = 0,
                    inflight = false,
                    lastView = null,
                    clipboardBound = false;
                let _popupHandlerAttached = false;

                // Assistant activity guard
                let _isActiveFn = () =>
                {
                    try
                    {
                        if (unsafeWindow?.CacheturAssistant?.isActive) return !!unsafeWindow.CacheturAssistant.isActive();
                        if (typeof unsafeWindow?.isCacheturAssistantActive === "function") return !!unsafeWindow.isCacheturAssistantActive();
                        if (typeof unsafeWindow?.cacheturAssistantActive === "boolean") return !!unsafeWindow.cacheturAssistantActive;
                    }
                    catch (_)
                    {}
                    return true;
                };
                let _lastActive = null,
                    _activeWatch = null;

                function _isActiveSafe()
                {
                    try
                    {
                        return !!_isActiveFn();
                    }
                    catch (_)
                    {
                        return true;
                    }
                }

                // CSS
                try
                {
                    GM_addStyle(`
        /* --- Core POI icon container --- */
        .ct-poi-icon{
          background:transparent!important;
          border:0!important;
          box-shadow:none!important;
          border-radius:0!important;
          padding:0!important;
          transform:translate(-50%,-50%);
          pointer-events:auto;
          white-space:nowrap;
          font:14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
          /* Keep a subtle halo on the whole label (helpful when no per-emoji span is used) */
          text-shadow:-1px 0 #fff,0 1px #fff,1px 0 #fff,0 -1px #fff;
        }

        .ct-poi-img{
          transform:translate(-50%,-50%);
          pointer-events:auto
        }

        /* --- Leaflet popup tweaks --- */
        .leaflet-popup-pane{z-index:10000!important;}
        .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#fff!important;opacity:1!important;pointer-events:auto!important;}
        .leaflet-popup-content,.leaflet-popup-content *{pointer-events:auto!important;}

        /* --- Small UI button --- */
        .ct-copy-btn{
          margin-left:6px;
          padding:2px 8px;
          border:1px solid rgba(0,0,0,.2);
          border-radius:10px;
          background:#fff;
          cursor:pointer;
          font:12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        }
        .ct-copy-btn:hover{background:#f4f4f4;}

        .ct-list{margin:.25em 0 .35em 1em;padding:0}
        .ct-list li{margin:.15em 0}

        /* --- Emoji visibility helpers (used by <span class="ct-emoji ...">...</span>) --- */
        .ct-emoji{
          /* Make the glyph pop on top of map tiles */
          font-size:18px;           /* adjust to taste */
          line-height:1;
          display:inline-block;
          /* strong white halo around the glyph */
          text-shadow:
            -1px 0 #fff, 1px 0 #fff, 0 -1px #fff, 0 1px #fff,
            0 0 4px #fff;
        }

        /* Extra dark look for food/picnic (grayscale + lower brightness + higher contrast) */
        .ct-emoji.ct-emoji--food{
          filter: grayscale(1) brightness(0.45) contrast(1.35);
        }

        /* (Optional) circular badge if you ever want even more separation from the map */
        .ct-emoji--badge{
          padding:2px 4px;
          border-radius:9999px;
          background:#fff;
          box-shadow:0 0 0 1px #0003; /* subtle edge */
        }
      `);
                }
                catch (e)
                {}

                // Leaflet helpers
                const getL = () => (typeof unsafeWindow !== "undefined" && unsafeWindow.L) ? unsafeWindow.L : window.L;
                const isLoaded = (m) =>
                {
                    try
                    {
                        if (!m) return false;
                        if (m._loaded === true) return true;
                        const z = (typeof m.getZoom === "function") ? m.getZoom() : null;
                        const b = (typeof m.getBounds === "function") ? m.getBounds() : null;
                        const hasBounds = !!(b && (b.getSouth || b._southWest));
                        const sz = (typeof m.getSize === "function") ? m.getSize() : null;
                        const hasSize = !!(sz && sz.x > 0 && sz.y > 0);
                        return hasBounds || (z != null && !isNaN(z)) || hasSize;
                    }
                    catch (_)
                    {
                        return false;
                    }
                };
                const divIcon = (html) => getL().divIcon(
                {
                    className: "ct-poi-icon",
                    html
                });

                function unwrapLeafletMap(m)
                {
                    if (!m) return null;
                    if (typeof m.getBounds === "function" && typeof m.addLayer === "function") return m;
                    if (m.map?.getBounds) return m.map;
                    if (m.leafletMap?.getBounds) return m.leafletMap;
                    if (m._map?.getBounds) return m._map;
                    try
                    {
                        const uw = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
                        if (uw?.pgc_map?.getBounds) return uw.pgc_map;
                        if (uw?.pgc_map?.map?.getBounds) return uw.pgc_map.map;
                        if (uw?.gc_map?.getBounds) return uw.gc_map;
                        if (uw?.gc_map?.map?.getBounds) return uw.gc_map.map;
                        if (uw?.gc_map_new?.getBounds) return uw.gc_map_new;
                        if (uw?.gc_map_new?.map?.getBounds) return uw.gc_map_new.map;
                        if (uw?.cacheturGCMap?.getBounds) return uw.cacheturGCMap;
                        if (uw?.MapSettings)
                        {
                            const cand = uw.MapSettings.Map || uw.MapSettings.map || uw.MapSettings.leafletMap;
                            if (cand?.getBounds) return cand;
                        }
                        if (uw?.freeDraw?.map?.getBounds) return uw.freeDraw.map;
                        if (uw?.map?.getBounds) return uw.map;
                    }
                    catch (_)
                    {}
                    return null;
                }

                function bboxArray(b)
                {
                    if (!b) return null;
                    if (typeof b.getSouth === "function") return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
                    if (typeof b.getSouthWest === "function")
                    {
                        const sw = b.getSouthWest(),
                            ne = b.getNorthEast();
                        return [sw.lat, sw.lng, ne.lat, ne.lng];
                    }
                    if (b._southWest && b._northEast) return [b._southWest.lat, b._southWest.lng, b._northEast.lat, b._northEast.lng];
                    if (Array.isArray(b) && b.length === 4) return b;
                    if (typeof b.south === "number") return [b.south, b.west, b.north, b.east];
                    return null;
                }

                function bboxArea(b)
                {
                    if (!b) return 0;
                    const [S, W, N, E] = b;
                    return Math.max(0, N - S) * Math.max(0, E - W);
                }

                function centers(b)
                {
                    const [S, W, N, E] = b;
                    return [(S + N) / 2, (W + E) / 2];
                }

                function metersBetween(a, b)
                {
                    const R = 6371000,
                        toRad = d => d * Math.PI / 180;
                    const dLat = toRad(b[0] - a[0]),
                        dLon = toRad(b[1] - a[1]);
                    const la1 = toRad(a[0]),
                        la2 = toRad(b[0]);
                    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
                    return 2 * R * Math.asin(Math.sqrt(h));
                }

                function viewChangedEnough(m)
                {
                    if (!m?.getBounds) return true;
                    const b = bboxArray(m.getBounds()),
                        z = m.getZoom?.() ?? 0,
                        c = centers(b);
                    if (!lastView)
                    {
                        lastView = {
                            center: c,
                            zoom: z,
                            bbox: b
                        };
                        return true;
                    }
                    const moved = metersBetween(lastView.center, c);
                    const zoomChanged = z !== lastView.zoom;
                    const a1 = bboxArea(lastView.bbox),
                        a2 = bboxArea(b);
                    const areaDelta = a1 ? Math.abs(a2 - a1) / a1 : 1;
                    const should = zoomChanged || moved > 300 || areaDelta > 0.25;
                    if (should) lastView = {
                        center: c,
                        zoom: z,
                        bbox: b
                    };
                    return should;
                }

                const escapeHtml = (s) => String(s || "").replace(/[&<>"']/g, c => (
                {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                } [c]));

                // ---------- Emoji helpers for better map visibility -------------------------

                // Predefined emojis with text-variant (U+FE0E) where suitable (darker glyphs)
                const EMO = {
                    food: "🍽︎", // U+1F37D + FE0E
                    bench: "🪑︎",
                    picnic: "🍽︎",
                    shelter: "🏠︎",
                    wc: "🚻︎",
                    water: "💧︎",
                    dump: "🚐︎💩︎",
                    ev: "🔌︎",
                    fuel: "⛽︎",
                    parking: "🅿️", // keep emoji variant for recognisable blue P
                    lodging: "🛏︎",
                    store: "🏬︎",
                    terminal: "🚉︎",
                    rv: "🚐︎",
                    wildcamp: "⛺︎",
                    attraction: "📍︎",
                    door: "🚪︎",
                    money: "💰︎"
                };

                // Wrap in span with halo; optional extra class per kind
                const em = (txt, cls = "") => `<span class="ct-emoji ${cls}">${escapeHtml(txt)}</span>`;

                // ---------------------------------------------------------------------------

                const yesNo = (v) =>
                {
                    if (v == null) return null;
                    const s = String(v).toLowerCase();
                    if (/^(yes|only|true|1)$/.test(s)) return tt("common.yes");
                    if (/^(no|false|0)$/.test(s)) return tt("common.no");
                    return v;
                };

                const normalizeAccess = (v) =>
                {
                    const s = String(v || "").toLowerCase();
                    if (!s) return null;
                    if (s === "yes" || s === "public") return `${em(EMO.door)} ${tt("poi.access_public")}`;
                    if (s === "customers") return `${em(EMO.door)} ${tt("poi.access_customers")}`;
                    if (s === "permissive") return `${em(EMO.door)} permissive`;
                    if (s === "private") return `${em(EMO.door)} ${tt("poi.access_private")}`;
                    return `${em(EMO.door)} ${s}`;
                };
                const normalizeFee = (v) =>
                {
                    if (v == null) return null;
                    const s = String(v).toLowerCase();
                    if (s === "yes" || s === "true" || s === "1") return `${em(EMO.money)} ${tt("common.yes")}`;
                    if (s === "no" || s === "false" || s === "0") return `${em(EMO.money)} ${tt("common.no")}`;
                    return `${em(EMO.money)} ${v}`;
                };

                function friendlyNameFor(t = {}, cat)
                {
                    const explicit = t.name || t.operator || t.brand || t.ref;
                    if (explicit && String(explicit).trim()) return String(explicit).trim();
                    if (cat === "rest")
                    {
                        if (t.amenity === "bench" || t.bench === "yes" || t["amenity:bench"] === "yes")
                            return `${em(EMO.bench)} ${tt("poi.bench",{defaultValue:"Bench"})}`;
                        if (t.amenity === "picnic_table" || t.picnic_table === "yes" || t["amenity:picnic_table"] === "yes")
                            return `${em(EMO.picnic,"ct-emoji--food")} ${tt("poi.picnicTable",{defaultValue:"Picnic table"})}`;
                        if (t.amenity === "shelter" || t.shelter === "yes")
                            return `${em(EMO.shelter)} ${tt("poi.shelter",{defaultValue:"Shelter"})}`;
                        if (t.toilets === "yes" || t.amenity === "toilets")
                            return `${em(EMO.wc)} ${tt("poi.wc",{defaultValue:"WC"})}`;
                        if (t.drinking_water === "yes" || t.water_point === "yes")
                            return `${em(EMO.water)} ${tt("poi.drinkingWater",{defaultValue:"Drinking water"})}`;
                        if (t["sanitary_dump_station"] === "yes")
                            return `${em(EMO.dump)} ${tt("poi.sanitaryDump",{defaultValue:"Sanitary dump"})}`;
                        return tt("poi.restArea",
                        {
                            defaultValue: "Rest area"
                        });
                    }
                    if (cat === "ev") return `${em(EMO.ev)} ${tt("poi.evCharging",{defaultValue:"EV charging"})}`;
                    if (cat === "fuel") return `${em(EMO.fuel)} ${tt("poi.fuelStation",{defaultValue:"Fuel station"})}`;
                    if (cat === "parking") return `${em(EMO.parking)} ${tt("poi.parking",{defaultValue:"Parking"})}`;
                    if (cat === "lodging") return `${em(EMO.lodging)} ${tt("poi.lodging",{defaultValue:"Lodging"})}`;
                    if (cat === "store") return `${em(EMO.store)} ${tt("poi.store",{defaultValue:"Store"})}`;
                    if (cat === "terminal") return `${em(EMO.terminal)} ${tt("poi.terminal",{defaultValue:"Terminal"})}`;
                    if (cat === "rv") return `${em(EMO.rv)} ${tt("poi.rvSite",{defaultValue:"Motorhome / caravan"})}`;
                    if (cat === "wildcamp") return `${em(EMO.wildcamp)} ${tt("poi.wildcamp",{defaultValue:"Wild/primitive camping"})}`;
                    if (cat === "food") return `${em(EMO.food,"ct-emoji--food")} ${tt("poi.foodDrink",{defaultValue:"Food & drink"})}`;
                    if (cat === "attraction") return `${em(EMO.attraction)} ${tt("poi.attraction",{defaultValue:"Attraction"})}`;
                    return tt("poi.place",
                    {
                        defaultValue: "Place"
                    });
                }

                function formatDmm(lat, lon)
                {
                    const latStr = dmmSingle(lat, true),
                        lonStr = dmmSingle(lon, false);
                    return `${latStr} ${lonStr}`;
                }

                function dmmSingle(value, isLat)
                {
                    const hemi = isLat ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
                    const av = Math.abs(value);
                    let deg = Math.floor(av + 1e-12);
                    let min = (av - deg) * 60;
                    min = Math.round(min * 1000) / 1000;
                    if (min >= 60)
                    {
                        min = 0;
                        deg += 1;
                    }
                    const degStr = isLat ? String(deg).padStart(2, "0") : String(deg).padStart(3, "0");
                    return `${hemi} ${degStr}° ${min.toFixed(3)}'`;
                }
                const pickLatLon = (el) => el.type === "node" ?
                {
                    lat: el.lat,
                    lon: el.lon
                } : (el.center || null);

                function osmLink(el)
                {
                    if (!el?.type || !el?.id) return null;
                    if (el.type === "node") return `https://www.openstreetmap.org/node/${el.id}`;
                    if (el.type === "way") return `https://www.openstreetmap.org/way/${el.id}`;
                    if (el.type === "relation") return `https://www.openstreetmap.org/relation/${el.id}`;
                    return null;
                }
                const linkRow = (label, url) => url ? `<div><a class="ct-ext-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></div>` : "";

                function makeSearchQuery(t, el, place, cat)
                {
                    const name = (t.name || "").trim();
                    const labels = {
                        ev: "EV charging station",
                        fuel: "fuel station",
                        parking: "parking",
                        lodging: "hotel",
                        food: "restaurant",
                        store: "shop",
                        terminal: "station",
                        attraction: "attraction",
                        rv: "motorhome site",
                        wildcamp: "wild camping",
                        rest: "rest area"
                    };
                    const base = name || labels[cat] || "place";
                    if (place) return `${base} ${place}`.trim();
                    if (name) return name;
                    const p = pickLatLon(el);
                    return p ? `${base} ${p.lat.toFixed(5)} ${p.lon.toFixed(5)}` : base;
                }

                function googleSearchLink(t, el, place, cat)
                {
                    return `https://www.google.com/search?q=${encodeURIComponent(makeSearchQuery(t, el, place, cat))}`;
                }

                function tripAdvisorSearchLink(t, el, place, cat)
                {
                    return `https://www.tripadvisor.com/Search?q=${encodeURIComponent(makeSearchQuery(t, el, place, cat))}`;
                }

                function httpJson(url, tm = 8000)
                {
                    return new Promise((resolve, reject) =>
                    {
                        GM_xmlhttpRequest(
                        {
                            method: "GET",
                            url,
                            headers:
                            {
                                "Accept": "application/json"
                            },
                            timeout: tm,
                            onload: r =>
                            {
                                try
                                {
                                    resolve(JSON.parse(r.responseText));
                                }
                                catch (e)
                                {
                                    reject(e);
                                }
                            },
                            onerror: reject,
                            ontimeout: () => reject(new Error("timeout"))
                        });
                    });
                }
                const ACCEPT_LANG = "en,nb,no,nn,de";
                const REVERSE_ADMIN_CACHE = new Map();

                async function reverseAdmin(lat, lon)
                {
                    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
                    if (REVERSE_ADMIN_CACHE.has(key)) return REVERSE_ADMIN_CACHE.get(key);
                    const out = {
                        municipality: null,
                        county: null,
                        state: null,
                        countryCode: null
                    };
                    const parseAddr = (a = {}) => (
                    {
                        municipality: a.city || a.town || a.village || a.hamlet || a.municipality || null,
                        county: a.county || a.state_district || a.region || a.province || null,
                        state: a.state || null,
                        countryCode: a.country_code || null
                    });

                    try
                    {
                        const nomiMuni = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&namedetails=1&accept-language=${encodeURIComponent(ACCEPT_LANG)}`;
                        const j = await httpJson(nomiMuni, 8000);
                        const a = parseAddr(j?.address ||
                        {});
                        out.municipality = a.municipality || out.municipality;
                        out.county = a.county || out.county;
                        out.state = a.state || out.state;
                        out.countryCode = a.countryCode || out.countryCode;
                    }
                    catch (_)
                    {}
                    if (!out.county || !out.countryCode)
                    {
                        try
                        {
                            const nomiCounty = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=8&addressdetails=1&namedetails=1&accept-language=${encodeURIComponent(ACCEPT_LANG)}`;
                            const j = await httpJson(nomiCounty, 8000);
                            const a = parseAddr(j?.address ||
                            {});
                            out.county = a.county || out.county || a.state_district || a.region || a.province || null;
                            out.state = a.state || out.state;
                            out.countryCode = a.countryCode || out.countryCode;
                        }
                        catch (_)
                        {}
                    }
                    if (!out.municipality || !out.county)
                    {
                        try
                        {
                            const ph = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
                            const j = await httpJson(ph, 8000);
                            const f = j?.features?.[0]?.properties ||
                            {};
                            out.municipality = out.municipality || f.city || f.town || f.village || f.name || null;
                            out.county = out.county || f.county || f.state || null;
                            out.state = out.state || f.state || null;
                        }
                        catch (_)
                        {}
                    }
                    REVERSE_ADMIN_CACHE.set(key, out);
                    return out;
                }

                function resolveWikiLangs()
                {
                    try
                    {
                        const raw = (unsafeWindow?.i18next?.language || window?.i18next?.language || "").toLowerCase();
                        const short = raw.replace("_", "-").split("-")[0];
                        const lang = short || "en";
                        return lang === "en" ? ["en"] : [lang, "en"];
                    }
                    catch (_)
                    {
                        return ["en"];
                    }
                }

                async function enrichSearchLinks(container, t, el, cat)
                {
                    try
                    {
                        const findIn = (sel) => (container?.querySelector?.(sel) || document.querySelector(sel));
                        const sentinel = findIn('[data-ct-search="1"]');
                        const countyRow = findIn('[data-ct-county="1"]');
                        const muniRow = findIn('[data-ct-muni="1"]');
                        const countyCell = countyRow?.querySelector?.('.ct-county-val') || countyRow?.querySelector?.('span');
                        const muniCell = muniRow?.querySelector?.('.ct-muni-val') || muniRow?.querySelector?.('span');

                        const p = pickLatLon(el);
                        if (!p)
                        {
                            countyRow?.remove();
                            muniRow?.remove();
                            sentinel?.removeAttribute("data-ct-search");
                            return;
                        }

                        let county = t["addr:county"] || t["is_in:county"] || t["county"] || null;
                        let municipality = t["addr:city"] || t["addr:town"] || t["addr:village"] || t["addr:hamlet"] || t["municipality"] || null;

                        let resolved = false;
                        const watchdog = setTimeout(() =>
                        {
                            if (!resolved)
                            {
                                if (county && countyCell) countyCell.textContent = county;
                                else countyRow?.remove();
                                if (municipality && muniCell) muniCell.textContent = municipality;
                                else muniRow?.remove();
                                sentinel?.removeAttribute("data-ct-search");
                            }
                        }, 16000);

                        let admin = null;
                        if (!county || !municipality)
                        {
                            try
                            {
                                admin = await reverseAdmin(p.lat, p.lon);
                                county = county || admin.county || admin.state || null;
                                municipality = municipality || admin.municipality || null;
                            }
                            catch (_)
                            {}
                        }
                        else
                        {
                            try
                            {
                                admin = await reverseAdmin(p.lat, p.lon);
                            }
                            catch (_)
                            {}
                        }

                        if (countyCell)
                        {
                            if (county && String(county).trim()) countyCell.textContent = String(county).trim();
                            else countyRow?.parentNode?.removeChild(countyRow);
                        }
                        if (muniCell)
                        {
                            if (municipality && String(municipality).trim()) muniCell.textContent = String(municipality).trim();
                            else muniRow?.parentNode?.removeChild(muniRow);
                        }

                        if (sentinel)
                        {
                            const g = findIn('a[data-ct-google]');
                            const tr = findIn('a[data-ct-trip]');
                            let placeForSearch = null;
                            if (municipality && county) placeForSearch = `${String(municipality).trim()} ${String(county).trim()}`;
                            else if (municipality) placeForSearch = String(municipality).trim();
                            else if (county) placeForSearch = String(county).trim();

                            const query = makeSearchQuery(t, el, placeForSearch, cat).trim();
                            const safe = encodeURIComponent(query);
                            if (g) g.href = `https://www.google.com/search?q=${safe}`;
                            if (tr) tr.href = `https://www.tripadvisor.com/Search?q=${safe}`;
                        }

                        if (cat === "attraction")
                        {
                            const hasWikiTag = !!(t.wikipedia || t.wikidata);
                            const hasName = !!(t.name && String(t.name).trim());
                            if (!hasWikiTag && hasName && sentinel)
                            {
                                const langs = resolveWikiLangs();
                                langs.forEach(l =>
                                {
                                    const html = linkRow(`Wikipedia (${l})`, `https://${l}.wikipedia.org/w/index.php?title=Special:Search&search=${encodeURIComponent(t.name)}&go=Go`);
                                    sentinel.insertAdjacentHTML("beforebegin", html);
                                });
                                const wd = linkRow("Wikidata (search)", `https://www.wikidata.org/wiki/Special:Search?search=${encodeURIComponent(t.name)}`);
                                sentinel.insertAdjacentHTML("beforebegin", wd);
                            }
                        }

                        sentinel?.removeAttribute("data-ct-search");
                        resolved = true;
                        clearTimeout(watchdog);
                    }
                    catch (e)
                    {
                        console.warn("[CT_LOC] enrichSearchLinks error", e);
                    }
                }

                function _popupContentFromEvent(evt)
                {
                    const p = evt?.popup;
                    return p?._contentNode || p?.getElement?.() || document.querySelector(".leaflet-popup-content") || null;
                }

                function attachPopupResolverHandlers()
                {
                    if (!map || _popupHandlerAttached || !map.on) return;
                    _popupHandlerAttached = true;
                    map.on("popupopen", (evt) =>
                    {
                        try
                        {
                            const node = _popupContentFromEvent(evt);
                            const src = evt?.popup?._source || null;
                            const tags = src && src.__ct_tags ||
                            {};
                            const el = src && src.__ct_el || null;
                            const cat = src && src.__ct_cat || null;
                            if (node && el) setTimeout(() => enrichSearchLinks(node, tags, el, cat), 0);
                        }
                        catch (e)
                        {
                            console.warn("[CT_LOC] popupopen handler error", e);
                        }
                    });
                }

                // EV / fuel helpers
                function listFuelTypes(t)
                {
                    const out = [];
                    for (const k of Object.keys(t ||
                        {}))
                        if (k.startsWith("fuel:") && t[k] === "yes") out.push(k.slice(5).replace(/_/g, " "));
                    return out.length ? out.join(", ") : null;
                }

                function formatPayment(t)
                {
                    const keys = Object.keys(t ||
                    {}).filter(k => k.startsWith("payment:") && t[k] === "yes");
                    return keys.length ? keys.map(k => k.split(":")[1].replace(/_/g, " ").toUpperCase()).join(", ") : null;
                }

                function evSocketList(tags)
                {
                    const known = [
                    {
                        keys: ["socket:type2_combo", "socket:ccs"],
                        label: "CCS2 (Type 2 combo)"
                    },
                    {
                        keys: ["socket:type1_combo", "socket:ccs1"],
                        label: "CCS1 (Type 1 combo)"
                    },
                    {
                        keys: ["socket:nacs"],
                        label: "NACS"
                    },
                    {
                        keys: ["socket:tesla_supercharger"],
                        label: "Tesla Supercharger (legacy)"
                    },
                    {
                        keys: ["socket:tesla_destination", "socket:tesla_dest"],
                        label: "Tesla Destination (legacy)"
                    },
                    {
                        keys: ["socket:chademo"],
                        label: "CHAdeMO"
                    },
                    {
                        keys: ["socket:type2"],
                        label: "Type 2 (AC)"
                    },
                    {
                        keys: ["socket:type1", "socket:j1772"],
                        label: "J1772 / Type 1 (AC)"
                    },
                    {
                        keys: ["socket:schuko"],
                        label: "Schuko (AC)"
                    },
                    {
                        keys: ["socket:nema_14_50"],
                        label: "NEMA 14-50"
                    },
                    {
                        keys: ["socket:nema_5_15"],
                        label: "NEMA 5-15"
                    },
                    {
                        keys: ["socket:nema_5_20"],
                        label: "NEMA 5-20"
                    },
                    {
                        keys: ["socket:tt_30"],
                        label: "TT-30"
                    }];
                    const li = [];
                    for (const def of known)
                    {
                        const key = def.keys.find(k => tags[k] || tags[`${k}:output`]);
                        if (!key) continue;
                        const cnt = tags[key];
                        const power = tags[`${key}:output`];
                        li.push(`<li>${escapeHtml(def.label)}${power ? ` — up to ${escapeHtml(power)}` : ""}${cnt ? `: ${escapeHtml(cnt)}` : ""}</li>`);
                    }
                    return li.length ? `<ul class="ct-list">${li.join("")}</ul>` : "";
                }

                // Numeric parse helper
                function ctParseNumber(val)
                {
                    if (val == null) return null;
                    const m = String(val).replace(",", ".").match(/-?\d+(\.\d+)?/);
                    return m ? parseFloat(m[0]) : null;
                }

                // Advanced matching
                function evMatchesAdvanced(tags)
                {
                    const adv = ADV_FILTERS.ev ||
                    {};
                    const allow = adv.sockets ||
                    {};
                    const minKW = Number(adv.minKW || 0);
                    const has = {
                        type2: !!(tags["socket:type2"] || tags["socket:type2:output"]),
                        ccs: !!(tags["socket:type2_combo"] || tags["socket:type2_combo:output"] || tags["socket:ccs"] || tags["socket:ccs:output"]),
                        chademo: !!(tags["socket:chademo"] || tags["socket:chademo:output"]),
                        schuko: !!(tags["socket:schuko"] || tags["socket:schuko:output"]),
                        type1: !!(tags["socket:type1"] || tags["socket:type1:output"]),
                        j1772: !!(tags["socket:j1772"] || tags["socket:j1772:output"] || tags["socket:type1"] || tags["socket:type1:output"]),
                        ccs1: !!(tags["socket:type1_combo"] || tags["socket:type1_combo:output"] || tags["socket:ccs1"] || tags["socket:ccs1:output"]),
                        nacs: !!(tags["socket:nacs"] || tags["socket:nacs:output"]),
                        tesla_sc: !!(tags["socket:tesla_supercharger"] || tags["socket:tesla_supercharger:output"]),
                        tesla_dest: !!(tags["socket:tesla_destination"] || tags["socket:tesla_destination:output"] || tags["socket:tesla_dest"] || tags["socket:tesla_dest:output"]),
                        nema1450: !!(tags["socket:nema_14_50"] || tags["socket:nema_14_50:output"]),
                        nema515: !!(tags["socket:nema_5_15"] || tags["socket:nema_5_15:output"]),
                        nema520: !!(tags["socket:nema_5_20"] || tags["socket:nema_5_20:output"]),
                        tt30: !!(tags["socket:tt_30"] || tags["socket:tt_30:output"])
                    };
                    const okSocket =
                        (allow.type2 && has.type2) || (allow.ccs && has.ccs) || (allow.chademo && has.chademo) || (allow.schuko && has.schuko) ||
                        (allow.type1 && has.type1) || (allow.j1772 && has.j1772) || (allow.ccs1 && has.ccs1) || (allow.nacs && has.nacs) ||
                        (allow.tesla_sc && has.tesla_sc) || (allow.tesla_dest && has.tesla_dest) ||
                        (allow.nema1450 && has.nema1450) || (allow.nema515 && has.nema515) || (allow.nema520 && has.nema520) || (allow.tt30 && has.tt30);
                    if (!okSocket) return false;

                    if (minKW > 0)
                    {
                        const outKeys = [];
                        const add = (cond, arr) =>
                        {
                            if (cond) outKeys.push(...arr);
                        };
                        add(allow.type2, ["socket:type2:output"]);
                        add(allow.ccs, ["socket:type2_combo:output", "socket:ccs:output"]);
                        add(allow.chademo, ["socket:chademo:output"]);
                        add(allow.schuko, ["socket:schuko:output"]);
                        add(allow.type1 || allow.j1772, ["socket:type1:output", "socket:j1772:output"]);
                        add(allow.ccs1, ["socket:type1_combo:output", "socket:ccs1:output"]);
                        add(allow.nacs, ["socket:nacs:output"]);
                        add(allow.tesla_sc, ["socket:tesla_supercharger:output"]);
                        add(allow.tesla_dest, ["socket:tesla_destination:output", "socket:tesla_dest:output"]);
                        add(allow.nema1450, ["socket:nema_14_50:output"]);
                        add(allow.nema515, ["socket:nema_5_15:output"]);
                        add(allow.nema520, ["socket:nema_5_20:output"]);
                        add(allow.tt30, ["socket:tt_30:output"]);

                        const outputs = outKeys.map(k => tags[k]).filter(Boolean);
                        if (!outputs.length)
                        {
                            if (tags["charging:output"]) outputs.push(tags["charging:output"]);
                            if (tags["output"]) outputs.push(tags["output"]);
                        }
                        const nums = outputs.join(";").split(/[;,/]/).map(s => parseFloat(s.replace(/[^0-9.]/g, ""))).filter(n => !isNaN(n));
                        const maxKw = nums.length ? Math.max(...nums) : null;
                        if (maxKw == null || maxKw < minKW) return false;
                    }
                    return true;
                }

                function lodgingMatchesAdvanced(tags)
                {
                    // Defensive defaults
                    const adv = ADV_FILTERS.lodging ||
                    {};
                    const types = adv.types ||
                    {};
                    const am = adv.amenities ||
                    {};

                    // Are any type/amenity filters actually enabled?
                    const enabledTypes = Object.keys(types).filter(k => !!types[k]).map(k => k.toLowerCase());
                    const amenityFlags = [
                        !!am.showers, !!am.toilets, !!am.drinking, !!am.wifi, !!am.reservation, !!am.price_free
                    ];
                    const hasTypeFilters = enabledTypes.length > 0;
                    const hasAmenityFilters = amenityFlags.some(Boolean);

                    // If nothing is constrained, accept everything in the "lodging" category
                    if (!hasTypeFilters && !hasAmenityFilters) return true;

                    // Determine lodging "kind" from tags
                    const norm = (v) => String(v || "").toLowerCase().replace(/-/g, "_");
                    let kind = norm(tags.tourism);
                    // Helpful fallbacks/aliases from common OSM data
                    if (!kind && norm(tags.building) === "hotel") kind = "hotel";
                    if (kind === "guesthouse") kind = "guest_house";
                    if (kind === "campground") kind = "camp_site";

                    // If type filters are enabled, enforce them strictly
                    if (hasTypeFilters)
                    {
                        if (!kind || !enabledTypes.includes(kind)) return false;
                    }

                    // Amenity checks
                    const yn = (v) => String(v || "").toLowerCase();

                    if (am.showers)
                    {
                        // OSM sometimes uses shower=yes (singular)
                        const hasShowers = yn(tags.showers) === "yes" || yn(tags.shower) === "yes";
                        if (!hasShowers) return false;
                    }

                    if (am.toilets)
                    {
                        if (yn(tags.toilets) !== "yes") return false;
                    }

                    if (am.drinking)
                    {
                        if (yn(tags.drinking_water) !== "yes") return false;
                    }

                    if (am.wifi)
                    {
                        const wifi = yn(tags.wifi);
                        const net = yn(tags.internet_access);
                        const hasWifi = wifi === "yes" || net === "wlan" || net === "yes";
                        if (!hasWifi) return false;
                    }

                    if (am.reservation)
                    {
                        const r = yn(tags.reservation);
                        if (!(r === "yes" || r === "required" || r === "only")) return false;
                    }

                    if (am.price_free)
                    {
                        // Minimal heuristic for "free": fee=no OR charge=0
                        const fee = yn(tags.fee);
                        const charge = String(tags.charge || "").trim();
                        if (!(fee === "no" || charge === "0")) return false;
                    }

                    return true;
                }

                function attractionMatchesAdvanced(t)
                {
                    const A = ADV_FILTERS.attraction;
                    const isMuseum = t.tourism === "museum";
                    const isArtwork = t.tourism === "artwork";
                    const isCastle = t.historic === "castle";
                    const isRuins = t.historic === "ruins";
                    const isMonument = t.historic === "monument";
                    const isMemorial = t.historic === "memorial";
                    const isArchaeo = t.historic === "archaeological_site";
                    const isChurch = (t.historic === "church") || (t.building === "church");
                    const passCulture =
                        (A.culture.museum && isMuseum) || (A.culture.artwork && isArtwork) || (A.culture.castle && isCastle) ||
                        (A.culture.ruins && isRuins) || (A.culture.monument && isMonument) ||
                        (A.culture.memorial && isMemorial) || (A.culture.archaeological_site && isArchaeo) || (A.culture.church && isChurch);

                    const isViewpoint = t.tourism === "viewpoint";
                    const isPicnic = t.tourism === "picnic_site";
                    const isPeak = t.natural === "peak";
                    const isVolcano = t.natural === "volcano";
                    const isWaterfall = t.natural === "waterfall";
                    const isCave = t.natural === "cave_entrance";
                    const passNature =
                        (A.nature.viewpoint && isViewpoint) || (A.nature.picnic_site && isPicnic) ||
                        (A.nature.peak && isPeak) || (A.nature.volcano && isVolcano) ||
                        (A.nature.waterfall && isWaterfall) || (A.nature.cave_entrance && isCave);

                    const isThemePark = t.tourism === "theme_park";
                    const isZoo = t.tourism === "zoo";
                    const isAquarium = t.tourism === "aquarium";
                    const isGallery = t.tourism === "gallery";
                    const isPlanet = t.tourism === "planetarium";
                    const isCoaster = (t.tourism === "attraction" && t.attraction === "roller_coaster");
                    const passRecreation =
                        (A.recreation.theme_park && isThemePark) || (A.recreation.zoo && isZoo) ||
                        (A.recreation.aquarium && isAquarium) || (A.recreation.gallery && isGallery) ||
                        (A.recreation.planetarium && isPlanet) || (A.recreation.roller_coaster && isCoaster);

                    const genericAttraction = (t.tourism === "attraction" && !t.attraction);
                    return passCulture || passNature || passRecreation || genericAttraction;
                }

                function storeMatchesAdvanced(tags)
                {
                    if (!tags) return false;

                    const S = ADV_FILTERS.store ||
                    {};
                    const kinds = S.kinds ||
                    {};
                    const brandNeedle = (S.brand || "").toLowerCase();

                    // Determine the "kind" from tags (shop / amenity / craft)
                    let kind =
                        (tags.shop && String(tags.shop)) ||
                        (tags.amenity === "pharmacy" ? "pharmacy" :
                            tags.amenity === "marketplace" ? "marketplace" :
                            tags.amenity === "bicycle_repair_station" ? "bicycle_repair_station" : "") ||
                        (tags.craft && String(tags.craft)) ||
                        "";

                    kind = kind.toLowerCase();

                    // Simple aliases to match UI keys
                    const alias = {
                        chemist: "pharmacy", // some regions use shop=chemist
                        doityourself: "hardware" // mirror of UI alias
                    };
                    if (alias[kind]) kind = alias[kind];

                    // If any sub-kinds are enabled, the item must match one of them
                    const enabledKinds = Object.entries(kinds)
                        .filter(([, on]) => !!on)
                        .map(([k]) => k.toLowerCase());

                    if (enabledKinds.length)
                    {
                        if (!kind) return false; // nothing to check against
                        if (!enabledKinds.includes(kind)) return false;
                    }

                    // Optional brand filter
                    if (brandNeedle)
                    {
                        const hay = [tags.brand, tags.operator, tags.name].map(v => (v || "").toLowerCase());
                        if (!hay.some(v => v.includes(brandNeedle))) return false;
                    }

                    return true;
                }

                // --- Advanced matchers: Terminal / RV / Wildcamp ----------------------------
                // Filters "terminal" category by selected modes and wheelchair accessibility.
                // Expects ADV_FILTERS.terminal = { modes:{rail,bus,ferry,airport,platform}, wheelchair:boolean }
                function terminalMatchesAdvanced(tags)
                {
                    const T = (typeof ADV_FILTERS !== "undefined" && ADV_FILTERS.terminal) ? ADV_FILTERS.terminal :
                    {};
                    const M = (T && T.modes) ? T.modes :
                    {};
                    const anyModeEnabled = !!(M && (M.rail || M.bus || M.ferry || M.airport || M.platform));

                    const v = (x) => String(x || "").toLowerCase();

                    // Normalize a few common OSM patterns into our 5 modes
                    let mode = null;
                    if (v(tags.railway))
                    {
                        // railway=station|halt|tram_stop etc.
                        mode = "rail";
                    }
                    else if (v(tags.aeroway) === "terminal" || v(tags.aeroway) === "aerodrome")
                    {
                        mode = "airport";
                    }
                    else if (v(tags.amenity) === "ferry_terminal" || v(tags.ferry) === "yes")
                    {
                        mode = "ferry";
                    }
                    else if (v(tags.highway) === "bus_stop" || v(tags.amenity) === "bus_station")
                    {
                        mode = "bus";
                    }
                    else if (v(tags.public_transport))
                    {
                        // public_transport=platform/station etc.
                        mode = "platform";
                    }

                    // If user enabled any mode filter, item must match one of them
                    if (anyModeEnabled)
                    {
                        if (!mode || !M[mode]) return false;
                    }

                    // Wheelchair constraint (YES or DESIGNATED passes)
                    if (T && T.wheelchair)
                    {
                        const w = v(tags.wheelchair);
                        if (!(w === "yes" || w === "designated")) return false;
                    }

                    return true;
                }

                // Filters "rv" category by amenities the user has enabled.
                // Expects ADV_FILTERS.rv = { dump, water, power, showers, toilets, free_only }
                function rvMatchesAdvanced(tags)
                {
                    const R = (typeof ADV_FILTERS !== "undefined" && ADV_FILTERS.rv) ? ADV_FILTERS.rv :
                    {};
                    if (!R) return true; // nothing to enforce

                    const v = (x) => String(x || "").toLowerCase();
                    const yes = (x) => v(x) === "yes";

                    // Dump station
                    if (R.dump)
                    {
                        const isDump =
                            yes(tags.sanitary_dump_station) ||
                            v(tags.amenity) === "sanitary_dump_station" ||
                            v(tags.waste_disposal) === "yes";
                        if (!isDump) return false;
                    }

                    // Drinking water / water point
                    if (R.water)
                    {
                        const hasWater =
                            yes(tags.drinking_water) ||
                            v(tags.amenity) === "water_point" ||
                            v(tags.water_point) === "yes";
                        if (!hasWater) return false;
                    }

                    // Power for caravans/motorhomes
                    if (R.power)
                    {
                        const hasPower =
                            yes(tags.power_supply) ||
                            yes(tags.electricity) ||
                            yes(tags["socket:caravan"]) ||
                            v(tags.amenity) === "power_supply";
                        if (!hasPower) return false;
                    }

                    // Showers
                    if (R.showers)
                    {
                        const hasShowers = yes(tags.showers) || yes(tags.shower);
                        if (!hasShowers) return false;
                    }

                    // Toilets
                    if (R.toilets)
                    {
                        if (!yes(tags.toilets)) return false;
                    }

                    // Free only: quick heuristic
                    if (R.free_only)
                    {
                        const fee = v(tags.fee);
                        const charge = String(tags.charge || "").trim();
                        if (!(fee === "no" || charge === "0")) return false;
                    }

                    return true;
                }

                // Filters "wildcamp" category by "allow_informal" and "only_basic" options.
                // Expects ADV_FILTERS.wildcamp = { allow_informal, only_basic }
                function wildcampMatchesAdvanced(tags)
                {
                    const W = (typeof ADV_FILTERS !== "undefined" && ADV_FILTERS.wildcamp) ? ADV_FILTERS.wildcamp :
                    {};
                    if (!W) return true; // nothing to enforce

                    const v = (x) => String(x || "").toLowerCase();

                    // If user disallows "informal", filter out informal camp sites
                    if (W.allow_informal === false || W.allow_informal === 0)
                    {
                        if (v(tags.informal) === "yes") return false;
                    }

                    // If user wants only "basic/backcountry"-like places, avoid serviced sites
                    if (W.only_basic)
                    {
                        const isExplicitBasic = ["basic", "backcountry", "wilderness"].includes(v(tags.camp_site));
                        const hasServices =
                            (v(tags.toilets) === "yes") ||
                            (v(tags.showers) === "yes") ||
                            (v(tags.wifi) === "yes") ||
                            (v(tags.power_supply) === "yes") ||
                            (v(tags.electricity) === "yes");
                        // Pass if explicitly basic/backcountry, or if not serviced
                        if (!isExplicitBasic && hasServices) return false;
                    }

                    return true;
                }

                function parkingMatchesAdvanced(t)
                {
                    const P = ADV_FILTERS.parking ||
                    {};

                    if (P.free_only && String(t.fee).toLowerCase() !== "no") return false;

                    if (P.covered_only)
                    {
                        const covered = String(t.covered || "").toLowerCase() === "yes";
                        const parkt = String(t.parking || "").toLowerCase();
                        if (!(covered || parkt === "multi-storey" || parkt === "underground")) return false;
                    }

                    if (P.paved_only)
                    {
                        const surf = String(t.surface || "").toLowerCase();
                        const ok = surf === "paved" || surf === "asphalt" || surf === "concrete" || surf === "paving_stones" || surf === "sett";
                        if (!ok) return false;
                    }

                    if (P.pnr_only)
                    {
                        const pnr = String(t.park_ride || t["park_and_ride"] || "").toLowerCase();
                        if (!(pnr === "yes")) return false;
                    }

                    const mincap = Number(P.min_capacity || 0);
                    if (mincap > 0)
                    {
                        const cap = parseInt(t.capacity, 10);
                        if (!(cap && cap >= mincap)) return false;
                    }

                    if (P.motorhome_ok)
                    {
                        const m = String(t.motorhome || "").toLowerCase();
                        const carav = String(t.caravans || t.caravan || "").toLowerCase();
                        if (!(m === "yes" || m === "designated" || m === "permissive" || carav === "yes")) return false;
                    }

                    if (P.disabled_only)
                    {
                        const dis = parseInt(t["capacity:disabled"], 10);
                        if (!(dis && dis > 0)) return false;
                    }

                    const lim = parseFloat(P.maxheight_limit || 0);
                    if (lim > 0)
                    {
                        const h = ctParseNumber(t.maxheight);
                        if (!(h && h <= lim)) return false;
                    }

                    return true;
                }

                function foodMatchesAdvanced(t)
                {
                    const F = ADV_FILTERS.food ||
                    {};

                    const kinds = F.kinds ||
                    {};
                    const enabledKinds = Object.entries(kinds).filter(([, v]) => !!v).map(([k]) => k);
                    if (enabledKinds.length)
                    {
                        const a = String(t.amenity || "");
                        const normalized = (a === "bar" || a === "pub") ? "pub_bar" : a;
                        if (!enabledKinds.includes(normalized)) return false;
                    }

                    const D = F.diet ||
                    {};
                    if (D.vegan)
                    {
                        const v = String(t["diet:vegan"] || "").toLowerCase();
                        if (!(v === "yes" || v === "only")) return false;
                    }
                    if (D.vegetarian)
                    {
                        const v = String(t["diet:vegetarian"] || "").toLowerCase();
                        if (!(v === "yes" || v === "only")) return false;
                    }

                    return true;
                }

                // Content helpers
                function descriptionBlock(t)
                {
                    const keys = Object.keys(t ||
                    {}).filter(k => k === "description" || k.startsWith("description:"));
                    if (!keys.length) return "";
                    const items = keys.map(k =>
                    {
                        const lang = k.includes(":") ? k.split(":")[1] : "default";
                        return `<li><b>${escapeHtml(lang)}:</b> ${escapeHtml(t[k])}</li>`;
                    });
                    return `<div><b>${escapeHtml(tt("poi.description"))}:</b><ul class="ct-list">${items.join("")}</ul></div>`;
                }

                function row(label, val)
                {
                    if (val == null || val === "") return "";

                    const isHtmlBlock =
                        typeof val === "string" && /^<(ul|ol|div|p)\b/i.test(val);

                    // allow our small, safe inline emoji markup
                    const isSafeInlineEmoji =
                        typeof val === "string" && /<span\s+class="ct-emoji\b[^>]*>/.test(val);

                    const isUrl =
                        typeof val === "string" && /^https?:\/\//i.test(val);

                    if (isHtmlBlock || isSafeInlineEmoji)
                    {
                        return `<div><b>${escapeHtml(label)}:</b> ${val}</div>`;
                    }
                    if (isUrl)
                    {
                        return `<div><b>${escapeHtml(label)}:</b> <a href="${escapeHtml(val)}" target="_blank" rel="noopener">${escapeHtml(val)}</a></div>`;
                    }
                    return `<div><b>${escapeHtml(label)}:</b> ${escapeHtml(val)}</div>`;
                }

                function determineMode(t)
                {
                    if (t.railway) return "Rail";
                    if (t.aeroway === "terminal") return "Air";
                    if (t.amenity === "ferry_terminal") return "Ferry";
                    if (t.highway === "bus_stop" || t.amenity === "bus_station") return "Bus";
                    if (t.public_transport) return "Transit";
                    return null;
                }

                function campingSchema(t)
                {
                    return [
                        [tt("poi.operator"), "operator"],
                        [tt("poi.reservation"), "reservation"],
                        [tt("poi.showers"), (ttags) => yesNo(ttags.shower)],
                        [tt("poi.toilets"), (ttags) => yesNo(ttags.toilets)],
                        [tt("poi.internet"), (ttags) => ttags.internet_access || ttags.wifi || null],
                        [tt("poi.drinkingWater"), (ttags) => yesNo(ttags.drinking_water || ttags.water_point)],
                        [tt("poi.caravansAllowed"), (ttags) => yesNo(ttags.caravans || ttags.caravan)],
                        [tt("poi.tentsAllowed"), "tents"],
                        [tt("poi.rvMotorhome"), (ttags) => yesNo(ttags.motorhome)],
                        [tt("poi.sanitaryDump"), (ttags) => yesNo(ttags.sanitary_dump_station || ttags.waste_disposal)],
                        [tt("poi.recyclingWaste"), (ttags) => yesNo(ttags.recycling || ttags.waste_disposal)],
                        [tt("poi.price"), "price"],
                        [tt("poi.payment"), (ttags) => formatPayment(ttags)],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"]
                    ];
                }

                const POPUP_TEMPLATES = {
                    rest: (el) =>
                    {
                        const t = el.tags ||
                        {};
                        const rows = [];
                        const facilities = [];
                        const isBench = t.amenity === "bench" || t["amenity:bench"] === "yes" || t.bench === "yes";
                        if (isBench)
                        {
                            let benchTxt = tt("poi.bench");
                            if (t.backrest === "yes") benchTxt += ` (${tt("poi.backrest")})`;
                            if (t.armrest === "yes") benchTxt += (benchTxt.includes("(") ? `, ${tt("poi.armrests")}` : ` (${tt("poi.armrests")})`);
                            facilities.push(benchTxt);
                        }
                        if (t.amenity === "picnic_table" || t["amenity:picnic_table"] === "yes" || t.picnic_table === "yes")
                        {
                            const cnt = t["picnic_table:count"] || t["capacity:picnic_table"];
                            facilities.push(`${tt("poi.picnicTable")}${cnt ? ` × ${String(cnt)}` : ""}`);
                        }
                        if (t.shelter === "yes" || t.amenity === "shelter") facilities.push(tt("poi.shelter"));

                        if (t.toilets === "yes" || t.amenity === "toilets") facilities.push(tt("poi.toilets"));
                        if (t.shower === "yes") facilities.push(tt("poi.showers"));
                        if (t.drinking_water === "yes" || t.water_point === "yes") facilities.push(tt("poi.drinkingWater"));
                        if (t["waste_disposal"] === "yes") facilities.push(tt("poi.wasteDisposal"));
                        if (t["sanitary_dump_station"] === "yes") facilities.push(tt("poi.sanitaryDump"));
                        if (t.restaurant === "yes") facilities.push(tt("poi.restaurant"));
                        if (t.cafe === "yes") facilities.push(tt("poi.cafe"));
                        if (t.fast_food === "yes") facilities.push(tt("poi.fastFood"));

                        const fuelFlags = [];
                        for (const k of Object.keys(t))
                            if (k.startsWith("fuel:") && t[k] === "yes") fuelFlags.push(k.slice(5).replace(/_/g, " "));
                        if (fuelFlags.length) facilities.push(`${tt("poi.fuel")}: ${fuelFlags.join(", ")}`);
                        if (t["fuel:electricity"] === "yes" || t.amenity === "charging_station") facilities.push(tt("poi.evCharging"));

                        if (facilities.length) rows.push(`<div><b>${escapeHtml(tt("poi.facilities"))}:</b> ${escapeHtml(facilities.join(", "))}</div>`);
                        if (t["capacity:hgv"]) rows.push(`<div><b>${escapeHtml(tt("poi.capacityHgv"))}:</b> ${escapeHtml(t["capacity:hgv"])}</div>`);
                        if (t["capacity:motorcar"]) rows.push(`<div><b>${escapeHtml(tt("poi.capacityCars"))}:</b> ${escapeHtml(t["capacity:motorcar"])}</div>`);
                        if (t.capacity) rows.push(`<div><b>${escapeHtml(tt("poi.capacityLabel"))}:</b> ${escapeHtml(t.capacity)}</div>`);

                        const descKeys = Object.keys(t).filter(k => k === "description" || k.startsWith("description:"));
                        if (descKeys.length)
                        {
                            const items = descKeys.map(k =>
                            {
                                const lang = k.includes(":") ? k.split(":")[1] : "default";
                                return `<li><b>${escapeHtml(lang)}:</b> ${escapeHtml(t[k])}</li>`;
                            });
                            rows.push(`<div><b>${escapeHtml(tt("poi.description"))}:</b><ul class="ct-list">${items.join("")}</ul></div>`);
                        }

                        if (t.maxstay) rows.push(`<div><b>${escapeHtml(tt("poi.maxStay"))}:</b> ${escapeHtml(t.maxstay)}</div>`);
                        if (t["maxstay:conditional"]) rows.push(`<div><b>${escapeHtml(tt("poi.maxStayConditional"))}:</b> ${escapeHtml(t["maxstay:conditional"])}</div>`);

                        const rvBits = [];
                        if (t.motorhome) rvBits.push(`${tt("poi.rvMotorhome")}: ${escapeHtml(yesNo(t.motorhome) || t.motorhome)}`);
                        if (t.caravans || t.caravan) rvBits.push(`${tt("poi.caravansAllowed")}: ${escapeHtml(yesNo(t.caravans || t.caravan) || t.caravans || t.caravan)}`);
                        if (rvBits.length) rows.push(`<div>${rvBits.join(" · ")}</div>`);

                        if (t.opening_hours) rows.push(`<div><b>${escapeHtml(tt("poi.openingHours"))}:</b> ${escapeHtml(t.opening_hours)}</div>`);
                        if (t.access) rows.push(`<div><b>${escapeHtml(tt("poi.access"))}:</b> ${escapeHtml(normalizeAccess(t.access))}</div>`);
                        if (t.fee != null) rows.push(`<div><b>${escapeHtml(tt("poi.fee"))}:</b> ${escapeHtml(normalizeFee(t.fee))}</div>`);
                        if (t.website) rows.push(`<div><b>${escapeHtml(tt("poi.website"))}:</b> <a href="${escapeHtml(t.website)}" target="_blank" rel="noopener">${escapeHtml(t.website)}</a></div>`);

                        return rows.join("");
                    }
                };

                const POPUP_SCHEMA = {
                    fuel: [
                        [tt("poi.brand"), (t) => t.brand || t.operator || null],
                        [tt("poi.operator"), "operator"],
                        [tt("poi.fuel_types"), (t) => listFuelTypes(t)],
                        [tt("poi.payment"), (t) => formatPayment(t)],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.price"), "price"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    ev: [
                        [tt("poi.power"), (t) => t["charging:output"] || t.output || null],
                        [tt("poi.sockets"), (t) => evSocketList(t)],
                        [tt("poi.authentication"), (t) => t.authentication || null],
                        [tt("poi.payment"), (t) => formatPayment(t)],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.operator"), "operator"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    parking: [
                        [tt("poi.name"), (t) => t.name || null],
                        [tt("poi.description"), (t) => t.description || null],
                        [tt("poi.capacity"), (t) => t.capacity || null],
                        ["♿ " + tt("poi.capacity_disabled"), (t) =>
                        {
                            const v = t["capacity:disabled"];
                            if (v == null) return null;
                            const s = String(v).trim().toLowerCase();
                            if (s === "yes") return tt("common.yes") || "Yes";
                            if (s === "no") return tt("common.no") || "No";
                            return v;
                        }],
                        [tt("poi.max_stay"), (t) => t.maxstay || t["maxstay:conditional"] || null],
                        [tt("poi.access"), (t) => normalizeAccess(t.access)],
                        [tt("poi.fee"), (t) => normalizeFee(t.fee)],
                        [tt("poi.type"), (t) => t.parking || null],
                        [tt("poi.surface"), (t) => t.surface || null],
                        [tt("poi.opening_hours"), (t) => t.opening_hours || null],
                        [tt("poi.park_ride"), (t) =>
                        {
                            const val = t["park_ride"] || t["park_and_ride"];
                            if (val == null) return null;
                            const s = String(val).toLowerCase();
                            if (s === "yes") return tt("common.yes") || "Yes";
                            if (s === "no") return tt("common.no") || "No";
                            return String(val).replace(/;/g, ", ");
                        }],
                        [tt("poi.operator"), (t) => t.operator || null],
                        [tt("poi.website"), "website"]
                    ],
                    lodging: [
                        [tt("poi.operator"), "operator"],
                        [tt("poi.tourism"), (t) => t.tourism || null],
                        [tt("poi.showers"), (t) => yesNo(t.shower)],
                        [tt("poi.toilets"), (t) => yesNo(t.toilets)],
                        [tt("poi.drinkingWater"), (t) => yesNo(t.drinking_water)],
                        [tt("poi.internet"), (t) => t.internet_access || t.wifi || null],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    food: [
                        [tt("poi.cuisine"), (t) => t.cuisine || null],
                        [tt("poi.payment"), (t) => formatPayment(t)],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    store: [
                        [tt("poi.shop"), (t) => t.shop || t.craft || null],
                        [tt("poi.brand"), (t) => t.brand || t.operator || null],
                        [tt("poi.payment"), (t) => formatPayment(t)],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    terminal: [
                        [tt("poi.mode"), (t) => determineMode(t)],
                        [tt("poi.ref"), (t) => t.ref || null],
                        [tt("poi.wheelchair"), (t) => t.wheelchair || null],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    attraction: [
                        [tt("poi.tourism"), (t) => t.tourism || null],
                        [tt("poi.historic"), (t) => t.historic || null],
                        [tt("poi.natural"), (t) => t.natural || null],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    rv: [
                        [tt("poi.operator"), "operator"],
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"],
                        [tt("poi.phone"), "phone"]
                    ],
                    wildcamp: [
                        [tt("poi.openingHours"), "opening_hours"],
                        [tt("poi.website"), "website"]
                    ]
                };

                const SEARCH_BUILDERS = {};

                // Filter helpers
                function tagHas(tags = {}, token)
                {
                    if (!token) return false;
                    const tok = String(token).toLowerCase();
                    for (const k of Object.keys(tags))
                    {
                        if (k.toLowerCase() === tok) return true;
                        const v = String(tags[k]).toLowerCase();
                        if (v === tok) return true;
                    }
                    return false;
                }

                function passesFilter(cat, tags)
                {
                    const f = FILTERS[cat];
                    if (!f) return true;
                    const inc = Array.isArray(f.include) ? f.include : [];
                    const exc = Array.isArray(f.exclude) ? f.exclude : [];
                    if (exc.length && exc.some(tok => tagHas(tags, tok))) return false;
                    if (inc.length === 0) return true;
                    return inc.some(tok => tagHas(tags, tok));
                }

                // Classification
                function isRV(ttags)
                {
                    if (ttags.tourism === "caravan_site") return true;
                    if (/^(yes|designated|permissive)$/i.test(ttags.motorhome || "")) return true;
                    if (ttags.caravans === "yes" || ttags.caravan === "yes") return true;
                    if (ttags.tourism === "camp_site" && (ttags.caravans === "yes" || /^(yes|designated|permissive)$/i.test(ttags.motorhome || ""))) return true;
                    return false;
                }

                function isWildcamp(tags)
                {
                    if (!tags) return false;
                    return (
                        (tags.tourism === "camp_site" && /^(basic|backcountry|wild|primitive)$/i.test(tags.camp_site || "")) ||
                        (tags.tourism === "camp_site" && /^(wildcamp|backcountry|primitive|basic)$/.test(tags.camp_type || "")) ||
                        (tags.tourism === "camp_site" && tags.camping === "wild") ||
                        (tags.tourism === "camp_site" && tags.informal === "yes") ||
                        (tags.leisure === "camping" && /^(basic|backcountry|wild|primitive)$/.test(tags.camp_site || "")) ||
                        tags.motorhome === "wildcamp"
                    );
                }

                function classifyFeature(tags)
                {
                    if (enabled.rv && isRV(tags) && passesFilter("rv", tags)) return "rv";
                    if (enabled.wildcamp && isWildcamp(tags) && passesFilter("wildcamp", tags)) return "wildcamp";
                    if (enabled.rest && (tags.highway === "rest_area" || /^(bench|picnic_table|shelter)$/.test(tags.amenity || "")) && passesFilter("rest", tags)) return "rest";
                    if (enabled.fuel && tags.amenity === "fuel" && passesFilter("fuel", tags)) return "fuel";
                    if (enabled.ev && tags.amenity === "charging_station" && passesFilter("ev", tags)) return "ev";
                    if (enabled.parking && (tags.amenity === "parking" || tags.amenity === "parking_entrance" || tags.parking === "layby") && passesFilter("parking", tags)) return "parking";
                    if (enabled.food && (tags.amenity && /^(restaurant|fast_food|cafe|pub|bar|food_court)$/.test(tags.amenity)) && passesFilter("food", tags)) return "food";
                    if (enabled.attraction && (
                            (tags.tourism && /^(viewpoint|attraction|information|museum|artwork|gallery|zoo|aquarium|theme_park|planetarium|picnic_site)$/.test(tags.tourism) && !/^(guidepost|map)$/.test(tags.information || "")) ||
                            (tags.historic && /^(castle|ruins|monument|memorial|fort|archaeological_site|church)$/.test(tags.historic)) ||
                            (tags.natural && /^(waterfall|cave_entrance|peak|volcano)$/.test(tags.natural))
                        ) && passesFilter("attraction", tags)) return "attraction";

                    if (enabled.store && passesFilter("store", tags))
                    {
                        if (tags.shop)
                        {
                            const S = ADV_FILTERS.store ||
                            {};
                            const anyKind = S.kinds && Object.values(S.kinds).some(Boolean);
                            if (anyKind)
                            {
                                if (storeMatchesAdvanced(tags)) return "store";
                                return null;
                            }
                            return "store";
                        }
                        if (tags.amenity === "pharmacy" || tags.amenity === "marketplace" || tags.amenity === "bicycle_repair_station" || tags.craft)
                        {
                            const S = ADV_FILTERS.store ||
                            {};
                            const anyKind = S.kinds && Object.values(S.kinds).some(Boolean);
                            if (anyKind)
                            {
                                if (storeMatchesAdvanced(tags)) return "store";
                                return null;
                            }
                            return "store";
                        }
                    }

                    if (enabled.terminal && (tags.railway || tags.amenity === "bus_station" || tags.amenity === "ferry_terminal" || tags.public_transport || tags.aeroway === "terminal") && passesFilter("terminal", tags)) return "terminal";
                    if (enabled.lodging && (tags.tourism && /^(hotel|motel|guest_house|hostel|alpine_hut|camp_site|caravan_site|chalet)$/.test(tags.tourism)) && passesFilter("lodging", tags)) return "lodging";
                    return null;
                }

                // Popup builder
                function buildPopup(el, cat)
                {
                    const t = el.tags ||
                    {};
                    const name = friendlyNameFor(t, cat);
                    const pos = pickLatLon(el);
                    const rows = [(function ()
                    {
                        const isSafeInlineEmoji = (typeof name === "string") && /<span\s+class="ct-emoji\b[^>]*>/.test(name);
                        return `<div style="font-weight:700">${isSafeInlineEmoji ? name : escapeHtml(name)}</div>`;
                    })()];

                    if (pos)
                    {
                        const dmm = formatDmm(pos.lat, pos.lon);
                        rows.push(`<div><b>${escapeHtml(tt("poi.coordinates"))}:</b> <code>${escapeHtml(dmm)}</code>
             <button type="button" class="ct-copy-btn" data-copy="${escapeHtml(dmm)}" title="${escapeHtml(tt("common.copy"))}">${escapeHtml(tt("common.copy"))}</button>
           </div>`);
                    }

                    rows.push(`<div data-ct-muni="1"><b>${escapeHtml(tt("poi.municipality"))}:</b> <span class="ct-muni-val">${escapeHtml(tt("common.resolving"))}</span></div>`);
                    rows.push(`<div data-ct-county="1"><b>${escapeHtml(tt("poi.county"))}:</b> <span class="ct-county-val">${escapeHtml(tt("common.resolving"))}</span></div>`);

                    if (cat === "rv")
                    {
                        campingSchema(t).forEach(([label, keyOrFn]) =>
                        {
                            const val = (typeof keyOrFn === "function") ? keyOrFn(t, el) : t[keyOrFn];
                            const line = row(label, val);
                            if (line) rows.push(line);
                        });
                    }
                    else if (cat === "lodging" && (t.tourism === "camp_site" || t.tourism === "caravan_site"))
                    {
                        campingSchema(t).forEach(([label, keyOrFn]) =>
                        {
                            const val = (typeof keyOrFn === "function") ? keyOrFn(t, el) : t[keyOrFn];
                            const line = row(label, val);
                            if (line) rows.push(line);
                        });
                    }
                    else if (cat === "rest" && typeof POPUP_TEMPLATES.rest === "function")
                    {
                        rows.push(POPUP_TEMPLATES.rest(el));
                    }
                    else
                    {
                        (POPUP_SCHEMA[cat] || []).forEach(([label, keyOrFn]) =>
                        {
                            const val = (typeof keyOrFn === "function") ? keyOrFn(t, el) : t[keyOrFn];
                            const line = row(label, val);
                            if (line) rows.push(line);
                        });
                    }

                    const desc = descriptionBlock(t);
                    if (desc) rows.push(desc);

                    if (cat === "attraction")
                    {
                        if (t.wikipedia)
                        {
                            const m = /^([a-z\-]+):(.*)$/i.exec(String(t.wikipedia).trim());
                            const lang = (m && m[1]) ? m[1] : "en";
                            const title = (m && m[2]) ? m[2] : String(t.wikipedia).trim();
                            rows.push(linkRow("Wikipedia", `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`));
                        }
                        else if (t.wikidata)
                        {
                            rows.push(linkRow("Wikidata", `https://www.wikidata.org/wiki/${encodeURIComponent(t.wikidata)}`));
                        }
                    }
                    else if (cat === "wildcamp")
                    {
                        const campType = t.camp_site || t.camp_type || t.camping || null;
                        if (campType) rows.push(row(tt("poi.camp_type"), campType));
                        const extras = [];
                        if (yesNo(t.toilets)) extras.push(tt("poi.toilets"));
                        if (yesNo(t.drinking_water || t.water_point)) extras.push(tt("poi.drinkingWater"));
                        if (yesNo(t.shower)) extras.push(tt("poi.showers"));
                        if (extras.length) rows.push(`<div><b>${escapeHtml(tt("poi.facilities"))}:</b> ${escapeHtml(extras.join(", "))}</div>`);
                        if (t.opening_hours) rows.push(row(tt("poi.openingHours"), t.opening_hours));
                        if (t.access) rows.push(row(tt("poi.access"), normalizeAccess(t.access)));
                        if (t.fee) rows.push(row(tt("poi.fee"), normalizeFee(t.fee)));
                        if (t.website) rows.push(row(tt("poi.website"), t.website));
                    }

                    const placeNow = null;
                    rows.push(`<div data-ct-search="1">
           <a data-ct-google href="${escapeHtml(googleSearchLink(t, el, placeNow, cat))}" target="_blank" rel="noopener">${escapeHtml(tt("poi.searchGoogle"))}</a>
           &nbsp;·&nbsp;
           <a data-ct-trip href="${escapeHtml(tripAdvisorSearchLink(t, el, placeNow, cat))}" target="_blank" rel="noopener">${escapeHtml(tt("poi.searchTripadvisor"))}</a>
         </div>`);

                    rows.push(`<div style="opacity:.7;font-size:12px;margin-top:4px">${escapeHtml(tt("poi.sourceOsm"))}</div>`);
                    rows.push(linkRow(tt("poi.openInOsm"), osmLink(el)));

                    return `<div>${rows.join("")}</div>`;
                }

                // Icons
                // Uses text-variant emojis (U+FE0E) for darker glyphs + CSS halo (.ct-emoji)
                const POI_ICON_SIZE = 20;
                const EV_ICON_URL = "https://cachetur.net/img/electrical.png";
                const ATTRACTION_ICON_URL = "https://cachetur.net/img/severdighet.png";

                // Text-variant emoji map (forces monochrome-ish glyphs on many platforms)
                const EMO_GLYPHS = {
                    rv: "🚐︎", // U+FE0E
                    wildcamp: "⛺︎",
                    fuel: "⛽︎",
                    parking: "🅿️", // keep emoji-style for recognisable blue P
                    food: "🍽︎",
                    lodging: "🛏︎",
                    store: "🛒︎",
                    terminal: "🚉︎",
                    rest: "🪑︎",
                    plus: "➕︎"
                };

                // Optional per-category CSS class to tune visibility (e.g. darker food icon)
                function emojiClassFor(cat)
                {
                    if (cat === "food" || cat === "rest") return "ct-emoji ct-emoji--food";
                    return "ct-emoji";
                }

                function iconFor(cat)
                {
                    const L = getL();
                    const anchor = [POI_ICON_SIZE / 2, POI_ICON_SIZE / 2];

                    // Image-based icons kept as before
                    if (cat === "ev")
                    {
                        return L.icon(
                        {
                            iconUrl: EV_ICON_URL,
                            iconSize: [POI_ICON_SIZE, POI_ICON_SIZE],
                            iconAnchor: anchor,
                            className: "ct-poi-img"
                        });
                    }
                    if (cat === "attraction")
                    {
                        return L.icon(
                        {
                            iconUrl: ATTRACTION_ICON_URL,
                            iconSize: [POI_ICON_SIZE, POI_ICON_SIZE],
                            iconAnchor: anchor,
                            className: "ct-poi-img ct-poi-attraction"
                        });
                    }

                    // Emoji-based icons rendered as a divIcon with halo via CSS
                    const glyph =
                        cat === "rv" ? EMO_GLYPHS.rv :
                        cat === "wildcamp" ? EMO_GLYPHS.wildcamp :
                        cat === "fuel" ? EMO_GLYPHS.fuel :
                        cat === "parking" ? EMO_GLYPHS.parking :
                        cat === "food" ? EMO_GLYPHS.food :
                        cat === "lodging" ? EMO_GLYPHS.lodging :
                        cat === "store" ? EMO_GLYPHS.store :
                        cat === "terminal" ? EMO_GLYPHS.terminal :
                        cat === "rest" ? EMO_GLYPHS.rest :
                        EMO_GLYPHS.plus;

                    const cls = emojiClassFor(cat);
                    const sizePx = Math.round(POI_ICON_SIZE * 0.85);

                    // aria-label improves accessibility in popups/tooltips
                    const html = `<span class="${cls}" style="font-size:${sizePx}px" aria-hidden="true">${glyph}</span>`;

                    return divIcon(html);
                }

                // Build Overpass QL query
                function buildQuery(boundsLike)
                {
                    const arr = bboxArray(boundsLike);
                    if (!arr) return null;
                    const b = `${arr[0]},${arr[1]},${arr[2]},${arr[3]}`;
                    const parts = [];

                    if (enabled.parking) parts.push(`nwr["amenity"~"^(parking|parking_entrance)$"](${b}); nwr["parking"="layby"](${b});`);
                    if (enabled.lodging) parts.push(`nwr["tourism"~"^(hotel|motel|guest_house|hostel|alpine_hut|camp_site|caravan_site|chalet)$"](${b});`);
                    if (enabled.food) parts.push(`nwr["amenity"~"^(restaurant|fast_food|cafe|pub|bar|food_court)$"](${b});`);
                    if (enabled.attraction) parts.push(`
          nwr["tourism"~"^(viewpoint|attraction|information|museum|artwork|gallery|zoo|aquarium|theme_park|planetarium|picnic_site)$"](${b})["information"!~"^(guidepost|map)$"];
          nwr["historic"~"^(castle|ruins|monument|memorial|archaeological_site|church)$"](${b});
          nwr["natural"~"^(waterfall|cave_entrance|peak|volcano)$"](${b});
          nwr["tourism"="attraction"]["attraction"="roller_coaster"](${b});
      `);
                    if (enabled.store) parts.push(`nwr["shop"](${b}); nwr["amenity"~"^(pharmacy|marketplace|bicycle_repair_station)$"](${b}); nwr["craft"](${b});`);
                    if (enabled.terminal) parts.push(`nwr["railway"~"^(station|halt|tram_stop)$"](${b}); nwr["amenity"~"^(bus_station|ferry_terminal)$"](${b}); nwr["public_transport"~"^(station|platform|stop_position)$"](${b}); nwr["aeroway"="terminal"](${b});`);
                    if (enabled.fuel) parts.push(`nwr["amenity"="fuel"](${b});`);
                    if (enabled.ev) parts.push(`nwr["amenity"="charging_station"](${b});`);

                    if (enabled.rv) parts.push(`
          nwr["tourism"="caravan_site"](${b});
          nwr["tourism"="camp_site"]["caravans"~"^(yes|designated)$"](${b});
          nwr["tourism"="camp_site"]["caravan"="yes"](${b});
          nwr["tourism"="camp_site"]["motorhome"~"^(yes|designated|permissive)$"](${b});
          nwr["amenity"="parking"]["motorhome"~"^(yes|designated|permissive)$"](${b});
          nwr["motorhome"="yes"](${b});
          nwr["caravan"="yes"](${b});
      `);

                    if (enabled.wildcamp) parts.push(`
          nwr["tourism"="camp_site"]["camp_site"~"^(basic|backcountry|wild|primitive)$"](${b});
          nwr["tourism"="camp_site"]["camp_type"~"^(wildcamp|backcountry|primitive|basic)$"](${b});
          nwr["tourism"="camp_site"]["camping"="wild"](${b});
          nwr["leisure"="camping"]["camp_site"~"^(basic|backcountry|wild|primitive)$"](${b});
          nwr["motorhome"="wildcamp"](${b});
          nwr["tourism"="camp_site"]["informal"="yes"](${b});
      `);

                    if (enabled.rest) parts.push(`
          nwr["highway"="rest_area"](${b});
          nwr["amenity"~"^(bench|picnic_table|shelter)$"](${b});
      `);

                    if (!parts.length) return null;
                    return `
    [out:json][timeout:30][maxsize:536870912];
    (
    ${parts.join("\n")}
    );
    out tags center;`.trim();
                }


                // ---------- Overpass HTTP (robust + temporary blacklist) ----------

                // Stores hosts temporarily marked as bad (e.g., 403/429 or repeated timeouts)
                const OVERPASS_BAD = new Map(); // url -> badUntil timestamp (ms)
                const OVERPASS_TEMP_BAN_MS_HARD = 60 * 60 * 1000; // 1h for 403/429
                const OVERPASS_TEMP_BAN_MS_SOFT = 10 * 60 * 1000; // 10m for timeouts

                // Checks if an endpoint is currently blacklisted
                function isTemporarilyBad(url)
                {
                    const until = OVERPASS_BAD.get(url) || 0;
                    if (!until) return false;
                    if (Date.now() > until)
                    {
                        OVERPASS_BAD.delete(url);
                        return false;
                    }
                    return true;
                }

                // Marks an endpoint as temporarily blacklisted
                function markTemporarilyBad(url, ms)
                {
                    OVERPASS_BAD.set(url, Date.now() + (ms || OVERPASS_TEMP_BAN_MS_SOFT));
                }

                // Sends one POST with a per-try timeout, aborting when exceeded
                function gmPost(url, query, perTryMs = OVERPASS_PER_TRY_TIMEOUT_MS)
                {
                    return new Promise((resolve, reject) =>
                    {
                        let done = false;
                        const body = "data=" + encodeURIComponent(query);
                        let req;

                        const finish = (fn, arg) =>
                        {
                            if (done) return;
                            done = true;
                            clearTimeout(timer);
                            try
                            {
                                req?.abort?.();
                            }
                            catch
                            {}
                            fn(arg);
                        };

                        const timer = setTimeout(() => finish(reject, new Error("per-try-timeout")), perTryMs);

                        req = GM_xmlhttpRequest(
                        {
                            method: "POST",
                            url,
                            headers:
                            {
                                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                                "Accept": "application/json"
                            },
                            data: body,
                            onload: (r) =>
                            {
                                if (r.status === 200)
                                {
                                    try
                                    {
                                        finish(resolve, JSON.parse(r.responseText));
                                    }
                                    catch (e)
                                    {
                                        finish(reject, e);
                                    }
                                }
                                else
                                {
                                    finish(reject, new Error("HTTP " + r.status));
                                }
                            },
                            onerror: (e) => finish(reject, e),
                            ontimeout: () => finish(reject, new Error("timeout"))
                        });
                    });
                }

                // Tries multiple endpoints; randomizes start; backoffs timeout; skips temporarily-bad hosts
                async function gmPostWithFailover(query)
                {
                    const order = [...OVERPASS];
                    const startIdx = Math.floor(Math.random() * order.length);
                    const baseSeq = order.slice(startIdx).concat(order.slice(0, startIdx));

                    // Prefer non-blacklisted; if all blacklisted, fall back to full list
                    const seq = baseSeq.filter(ep => !isTemporarilyBad(ep));
                    if (!seq.length) seq.push(...baseSeq);

                    let lastErr = null;
                    const tries = Math.min(seq.length, OVERPASS_MAX_RETRIES || seq.length);

                    for (let i = 0; i < tries; i++)
                    {
                        const ep = seq[i];
                        const perTry = Math.round((OVERPASS_PER_TRY_TIMEOUT_MS || 9000) * (i ? 1.5 : 1)); // simple backoff
                        try
                        {
                            if (DEBUG) console.info("[CT_POI] Overpass try:", ep, "timeout =", perTry, "ms");
                            const t0 = performance.now();
                            const res = await gmPost(ep, query, perTry);
                            if (DEBUG) console.info("[CT_POI] Overpass OK from", ep, "in", Math.round(performance.now() - t0), "ms");
                            return res;
                        }
                        catch (e)
                        {
                            lastErr = e;
                            const msg = String(e?.message || "");
                            if (DEBUG) console.warn("[CT_POI] Overpass failed from", ep, "->", msg);

                            // Hard blacklist on 403/429, soft on timeouts
                            if (msg.includes("HTTP 403") || msg.includes("HTTP 429"))
                            {
                                markTemporarilyBad(ep, OVERPASS_TEMP_BAN_MS_HARD);
                            }
                            else if (msg.includes("per-try-timeout") || msg.includes("timeout"))
                            {
                                markTemporarilyBad(ep, OVERPASS_TEMP_BAN_MS_SOFT);
                            }
                        }
                    }

                    throw lastErr || new Error("Overpass failed");
                }

                // Layers
                function rebuildLayerGroups()
                {
                    if (!map) return;
                    Object.keys(layers).forEach(k =>
                    {
                        if (layers[k])
                        {
                            layers[k].clearLayers();
                            map.removeLayer?.(layers[k]);
                            layers[k] = null;
                        }
                    });
                    ensureLayers();
                }

                function ensureLayers()
                {
                    const L = getL();
                    panesSupported = !!(map && map.createPane && map.getPane);
                    if (panesSupported && !map.getPane("ct-poi-pane"))
                    {
                        map.createPane("ct-poi-pane");
                        map.getPane("ct-poi-pane").style.zIndex = 580;
                    }
                    const makeGroup = (key) =>
                    {
                        if (!isTooOldForCluster() && CLUSTER_ENABLE && clusterReady && typeof L.markerClusterGroup === "function")
                        {
                            try
                            {
                                return L.markerClusterGroup(
                                {
                                    disableClusteringAtZoom: Number(CLUSTER_DISABLE_AT_ZOOM) || 0,
                                    spiderfyOnMaxZoom: true,
                                    showCoverageOnHover: false,
                                    chunkedLoading: true
                                });
                            }
                            catch (e)
                            {
                                console.warn("[CT_POI] Clustering disabled:", e && e.message);
                            }
                        }
                        return L.layerGroup();
                    };
                    Object.keys(layers).forEach(k =>
                    {
                        if (!layers[k]) layers[k] = makeGroup(k);
                    });
                    Object.values(layers).forEach(g =>
                    {
                        if (g && !map.hasLayer(g)) g.addTo(map);
                    });

                    try
                    {
                        unsafeWindow.cacheturPoi = {
                            paneId: panesSupported ? "ct-poi-pane" : null,
                            groups: layers,
                            enabled,
                            mapRef: map,
                            filters: FILTERS,
                            advFilters: ADV_FILTERS,
                            leafletVersion: (getL()?.version || "")
                        };
                    }
                    catch (_)
                    {}
                }

                function clearAll()
                {
                    Object.values(layers).forEach(g => g && g.clearLayers());
                }

                // Marker creation
                function markerFor(el, cat)
                {
                    const L = getL();
                    const pos = pickLatLon(el);
                    if (!pos) return null;
                    const opts = {
                        riseOnHover: true,
                        zIndexOffset: 1000
                    };
                    if (panesSupported) opts.pane = "ct-poi-pane";
                    opts.icon = iconFor(cat);
                    const m = L.marker([pos.lat, pos.lon], opts).bindPopup(buildPopup(el, cat),
                    {
                        maxWidth: 360
                    });
                    m.__ct_tags = el.tags ||
                    {};
                    m.__ct_el = el;
                    m.__ct_cat = cat;
                    m.on("popupopen", (evt) =>
                    {
                        setTimeout(() =>
                        {
                            const node = evt?.popup?.getElement?.() || evt?.popup?._contentNode || document.querySelector(".leaflet-popup-content");
                            const content = node?.querySelector?.(".leaflet-popup-content") || node;
                            if (content) enrichSearchLinks(content, m.__ct_tags, m.__ct_el, m.__ct_cat);
                            else console.warn("[CT_LOC] marker.popupopen: no content node");
                        }, 0);
                    });
                    return m;
                }

                // Rest de-dup
                function haversineMeters(lat1, lon1, lat2, lon2)
                {
                    const R = 6371000;
                    const toRad = (d) => d * Math.PI / 180;
                    const dLat = toRad(lat2 - lat1),
                        dLon = toRad(lon2 - lon1);
                    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
                    return 2 * R * Math.asin(Math.sqrt(a));
                }

                function sameSideHint(aTags = {}, bTags = {})
                {
                    const dirA = (aTags.direction || aTags.side || aTags["traffic:direction"] || "").toLowerCase();
                    const dirB = (bTags.direction || bTags.side || bTags["traffic:direction"] || "").toLowerCase();
                    if (!dirA || !dirB) return true;
                    const opp = (x, y) =>
                        (x.includes("north") && y.includes("south")) || (x.includes("south") && y.includes("north")) ||
                        (x.includes("east") && y.includes("west")) || (x.includes("west") && y.includes("east"));
                    return !opp(dirA, dirB);
                }

     // Fetch / classify / draw
    async function refetch() {
      // Abort if map is missing or not considered loaded
      if (!map) return;
      if (!isLoaded(map)) {
        if (DEBUG) console.info("[CT_POI] skip: map not loaded");
        return;
      }

      // Activity guard: only work when the assistant is active
      const active = _isActiveSafe();
      if (!active) {
        if (DEBUG) console.info("[CT_POI] skip: inactive");
        clearAll();
        inflight = false;
        lastFetch = Date.now();
        _lastActive = false;
        return;
      }
      _lastActive = true;

      // Rate/zoom/movement guards to avoid excessive fetching
      const z = map.getZoom?.() ?? 0;
      if (z <= MIN_ZOOM) {
        // Do NOT clear here — keep existing markers until user zooms in
        if (DEBUG) console.info("[CT_POI] skip: zoom <= MIN_ZOOM", z, MIN_ZOOM);
        return;
      }
      if (Date.now() - lastFetch < FETCH_COOLDOWN_MS) {
        if (DEBUG) console.info("[CT_POI] skip: cooldown");
        return;
      }
      if (!viewChangedEnough(map)) {
        if (DEBUG) console.info("[CT_POI] skip: minor move");
        return;
      }
      if (inflight) {
        if (DEBUG) console.info("[CT_POI] skip: already fetching");
        return;
      }
      inflight = true;
      lastFetch = Date.now();

      // Ensure marker clustering lib and layer groups are available
      if (CLUSTER_ENABLE && !clusterReady) await ensureMarkerClusterLib();
      ensureLayers();

      // Build Overpass query from current map bounds
      const q = buildQuery(map.getBounds?.());
      if (!q) {
        if (DEBUG) console.info("[CT_POI] skip: no categories enabled");
        clearAll();
        inflight = false;
        return;
      }

      // Execute Overpass query with failover
      if (DEBUG) console.info("[CT_POI] fetching …");
      const t0 = performance.now();
      let data = null;
      try {
        data = await gmPostWithFailover(q);
      } catch (err) {
        console.warn("[CT_POI] Overpass fetch failed:", err);
        inflight = false;
        return;
      }
      const dt = Math.round(performance.now() - t0);
      if (DEBUG) console.info("[CT_POI] got response in", dt, "ms");

      // Normalize response and clear previous markers
      const elements = (data && data.elements) || [];
      if (DEBUG) console.info("[CT_POI] elements:", elements.length);
      clearAll();

      // Counters and local state for de-duplication
      const added = {
        fuel: 0, ev: 0, parking: 0, lodging: 0, food: 0,
        attraction: 0, store: 0, terminal: 0, rv: 0, wildcamp: 0, rest: 0
      };
      const restChosen = [];

      // Classify, filter, and render markers
      elements.forEach(el => {
        const t = el.tags || {};
        const cat = classifyFeature(t);
        if (!cat || !enabled[cat]) return;

        // Apply advanced filters per category
        if (cat === "ev"        && !evMatchesAdvanced(t))        return;
        if (cat === "lodging"   && !lodgingMatchesAdvanced(t))   return;
        if (cat === "attraction"&& !attractionMatchesAdvanced(t))return;
        if (cat === "parking"   && !parkingMatchesAdvanced(t))   return;
        if (cat === "food"      && !foodMatchesAdvanced(t))      return;
        if (cat === "terminal"  && !terminalMatchesAdvanced(t))  return;
        if (cat === "rv"        && !rvMatchesAdvanced(t))        return;
        if (cat === "wildcamp"  && !wildcampMatchesAdvanced(t))  return;

        // De-duplicate very close rest-POIs on the same side
        if (cat === "rest") {
          const pos = pickLatLon(el);
          if (!pos) return;
          const conflict = restChosen.find(r => {
            const rp = pickLatLon(r);
            if (!rp) return false;
            const near = haversineMeters(pos.lat, pos.lon, rp.lat, rp.lon) < REST_DEDUP_METERS;
            if (!near) return false;
            return sameSideHint(el.tags, r.tags);
          });
          if (conflict) return;
          restChosen.push(el);
        }

        // Create marker and add to corresponding layer group
        const m = markerFor(el, cat);
        if (!m) return;
        layers[cat].addLayer(m);
        added[cat] = (added[cat] || 0) + 1;
      });

      // Debug summary and release inflight flag
      if (DEBUG) console.info("[CT_POI] added per category:", added);
      inflight = false;
    }
                function onMoveEnd()
                {
                    if (!_isActiveSafe())
                    {
                        clearAll();
                        return;
                    }
                    clearTimeout(moveTimer);
                    moveTimer = setTimeout(refetch, MOVE_DEBOUNCE_MS);
                }

                function bindClipboardOnce()
                {
                    if (clipboardBound) return;
                    clipboardBound = true;
                    document.addEventListener("click", async (e) =>
                    {
                        const btn = e.target && e.target.closest(".ct-copy-btn");
                        if (!btn) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                        const text = btn.dataset.copy || btn.getAttribute("data-copy") || "";
                        if (!text) return;
                        try
                        {
                            if (typeof GM_setClipboard === "function") GM_setClipboard(text,
                            {
                                type: "text",
                                mimetype: "text/plain"
                            });
                            else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
                            else
                            {
                                const ta = document.createElement("textarea");
                                ta.value = text;
                                ta.style.position = "fixed";
                                ta.style.top = "-1000px";
                                document.body.appendChild(ta);
                                ta.focus();
                                ta.select();
                                document.execCommand("copy");
                                document.body.removeChild(ta);
                            }
                            const old = btn.textContent;
                            btn.textContent = tt("common.copied");
                            setTimeout(() =>
                            {
                                btn.textContent = old || tt("common.copy");
                            }, 1200);
                        }
                        catch (err)
                        {
                            console.warn("[CT_POI] Copy failed:", err);
                            const old = btn.textContent;
                            btn.textContent = tt("common.failed");
                            setTimeout(() =>
                            {
                                btn.textContent = old || tt("common.copy");
                            }, 1200);
                        }
                    },
                    {
                        capture: true
                    });
                }

                (function bindLeafletCloseOnce()
                {
                    if (window.__ctBoundCloseX) return;
                    window.__ctBoundCloseX = true;
                    document.addEventListener("click", (e) =>
                    {
                        const btn = e.target && e.target.closest(".leaflet-popup-close-button");
                        if (!btn) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                        try
                        {
                            const map = (typeof ctGetUnsafeLeafletObject === "function") ? ctGetUnsafeLeafletObject() : (window.gcMap || window.map || null);
                            if (map && typeof map.closePopup === "function") map.closePopup();
                            else btn.dispatchEvent(new MouseEvent("click",
                            {
                                bubbles: true,
                                cancelable: true
                            }));
                        }
                        catch
                        {
                            try
                            {
                                btn.click();
                            }
                            catch
                            {}
                        }
                    },
                    {
                        capture: true
                    });
                })();

                GM_addStyle(`
      .leaflet-popup-close-button{pointer-events:auto!important;z-index:999999!important;}
      .leaflet-popup,.leaflet-popup-content-wrapper{pointer-events:auto!important;}
    `);

                // Public API
                return {
                    init: (opts) =>
                    {
                        enabled = Object.assign(enabled, opts ||
                        {});
                        if (typeof opts?.isActiveFn === "function") _isActiveFn = opts.isActiveFn;

                        const L = getL();
                        if (!L)
                        {
                            if (DEBUG) console.info("[CT_POI] init: Leaflet not present");
                            return false;
                        }
                        const raw = (typeof ctGetUnsafeLeafletObject === "function") ? ctGetUnsafeLeafletObject() : null;
                        try
                        {
                            if (DEBUG) console.info("[CT_POI] init: ctGetUnsafeLeafletObject() ->", raw, "keys:", raw ? Object.keys(raw) : null);
                        }
                        catch (_)
                        {}
                        const uw = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;

                        const m = unwrapLeafletMap(raw) || unwrapLeafletMap(uw.pgc_map) || unwrapLeafletMap(uw.gc_map) || unwrapLeafletMap(uw.gc_map_new);
                        if (!m)
                        {
                            if (DEBUG) console.info("[CT_POI] init: map not resolved yet");
                            return false;
                        }
                        map = m;

                        if (CLUSTER_ENABLE && isTooOldForCluster())
                        {
                            console.warn("[CT_POI] init: disabling clustering due to old Leaflet");
                            CLUSTER_ENABLE = false;
                        }
                        else if (CLUSTER_ENABLE)
                        {
                            ensureMarkerClusterLib();
                        }

                        if (!_popupHandlerAttached && map && map.on) attachPopupResolverHandlers();

                        map.off?.("moveend", onMoveEnd);
                        map.on?.("moveend", onMoveEnd);
                        bindClipboardOnce();

                        if (!_activeWatch)
                        {
                            _lastActive = _isActiveSafe();
                            _activeWatch = setInterval(() =>
                            {
                                const cur = _isActiveSafe();
                                if (cur !== _lastActive)
                                {
                                    _lastActive = cur;
                                    if (!cur)
                                    {
                                        if (DEBUG) console.info("[CT_POI] became INACTIVE -> clearing");
                                        clearAll();
                                    }
                                    else
                                    {
                                        if (DEBUG) console.info("[CT_POI] became ACTIVE -> refetch");
                                        refetch();
                                    }
                                }
                            }, 1200);
                        }

                        if (isLoaded(map))
                        {
                            ensureLayers();
                            refetch();
                        }
                        else
                        {
                            map.once?.("load", () =>
                            {
                                ensureLayers();
                                refetch();
                            });
                            let tries = 0;
                            const iv = setInterval(() =>
                            {
                                if (isLoaded(map))
                                {
                                    clearInterval(iv);
                                    ensureLayers();
                                    refetch();
                                }
                                else if (++tries > 20)
                                {
                                    clearInterval(iv);
                                    console.warn("[CT_POI] init: map never reported loaded; proceeding");
                                    ensureLayers();
                                    refetch();
                                }
                            }, 250);
                        }
                        return true;
                    },

                    updateEnabled: (opts) =>
                    {
                        enabled = Object.assign(enabled, opts ||
                        {});
                        if (DEBUG) console.info("[CT_POI] updateEnabled:", enabled);
                        refetch();
                    },

                    clear: () => clearAll(),

                    destroy: () =>
                    {
                        if (map)
                        {
                            map.off?.("moveend", onMoveEnd);
                            Object.keys(layers).forEach(k =>
                            {
                                if (layers[k])
                                {
                                    layers[k].clearLayers();
                                    map.removeLayer?.(layers[k]);
                                    layers[k] = null;
                                }
                            });
                        }
                        if (_activeWatch)
                        {
                            clearInterval(_activeWatch);
                            _activeWatch = null;
                        }
                        map = null;
                        try
                        {
                            if (unsafeWindow.cacheturPoi) delete unsafeWindow.cacheturPoi;
                        }
                        catch (_)
                        {}
                    },

                    debugRefetch: () => refetch(),

                    setMinZoom: (n) =>
                    {
                        MIN_ZOOM = Number(n) || 0;
                        if (DEBUG) console.info("[CT_POI] MIN_ZOOM set to", MIN_ZOOM);
                        refetch();
                    },

                    getFilters: () => JSON.parse(JSON.stringify(FILTERS)),
                    setFilter: (cat, cfg) =>
                    {
                        if (!FILTERS[cat]) FILTERS[cat] = {
                            include: [],
                            exclude: []
                        };
                        const cur = FILTERS[cat];
                        if (cfg && typeof cfg === "object")
                        {
                            if (Array.isArray(cfg.include)) cur.include = cfg.include.slice();
                            if (Array.isArray(cfg.exclude)) cur.exclude = cfg.exclude.slice();
                        }
                        if (DEBUG) console.info("[CT_POI] setFilter", cat, FILTERS[cat]);
                        refetch();
                    },
                    setFilters: (all) =>
                    {
                        if (all && typeof all === "object")
                        {
                            for (const k of Object.keys(all))
                            {
                                const cfg = all[k];
                                if (!FILTERS[k]) FILTERS[k] = {
                                    include: [],
                                    exclude: []
                                };
                                if (cfg && typeof cfg === "object")
                                {
                                    FILTERS[k].include = Array.isArray(cfg.include) ? cfg.include.slice() : [];
                                    FILTERS[k].exclude = Array.isArray(cfg.exclude) ? cfg.exclude.slice() : [];
                                }
                            }
                            if (DEBUG) console.info("[CT_POI] setFilters", FILTERS);
                            refetch();
                        }
                    },

                    setAdvFilters: function (adv)
                    {
                        if (!adv || typeof adv !== "object") return;

                        // --- EV ------------------------------------------------------------
                        if (adv.ev)
                        {
                            const s = adv.ev.sockets ||
                            {};
                            // Normalize alias: some UIs send j1772, others type1
                            const j1772 = (s.j1772 != null) ? s.j1772 : s.type1;

                            ADV_FILTERS.ev = ADV_FILTERS.ev ||
                            {
                                sockets:
                                {},
                                minKW: 0
                            };
                            ADV_FILTERS.ev.sockets.type2 = !!s.type2;
                            ADV_FILTERS.ev.sockets.ccs = !!s.ccs;
                            ADV_FILTERS.ev.sockets.chademo = !!s.chademo;
                            ADV_FILTERS.ev.sockets.schuko = !!s.schuko;
                            ADV_FILTERS.ev.sockets.type1 = !!s.type1;
                            ADV_FILTERS.ev.sockets.j1772 = !!j1772; // alias support
                            ADV_FILTERS.ev.sockets.ccs1 = !!s.ccs1;
                            ADV_FILTERS.ev.sockets.nacs = !!s.nacs;
                            ADV_FILTERS.ev.sockets.tesla_sc = !!s.tesla_sc;
                            ADV_FILTERS.ev.sockets.tesla_dest = !!s.tesla_dest;
                            ADV_FILTERS.ev.sockets.nema1450 = !!s.nema1450;
                            ADV_FILTERS.ev.sockets.nema515 = !!s.nema515;
                            ADV_FILTERS.ev.sockets.nema520 = !!s.nema520;
                            ADV_FILTERS.ev.sockets.tt30 = !!s.tt30;

                            // Accept both minKW and min_kw
                            const kw = (adv.ev.minKW != null ? adv.ev.minKW : adv.ev.min_kw) || 0;
                            ADV_FILTERS.ev.minKW = Number(kw) || 0;
                        }

                        // --- Lodging -------------------------------------------------------
                        if (adv.lodging)
                        {
                            ADV_FILTERS.lodging = ADV_FILTERS.lodging ||
                            {
                                types:
                                {},
                                amenities:
                                {}
                            };

                            // Types (hotel/hostel/…)
                            if (adv.lodging.types)
                            {
                                ADV_FILTERS.lodging.types = {
                                    ...ADV_FILTERS.lodging.types,
                                    ...adv.lodging.types
                                };
                            }

                            // Amenities (ensure the UI checkboxes actually affect filtering)
                            if (adv.lodging.amenities)
                            {
                                const a = adv.lodging.amenities;
                                ADV_FILTERS.lodging.amenities = {
                                    ...ADV_FILTERS.lodging.amenities,
                                    showers: !!a.showers,
                                    toilets: !!a.toilets,
                                    drinking: !!(a.drinking || a.drinking_water),
                                    wifi: !!a.wifi,
                                    reservation: !!a.reservation,
                                    // Some UIs call this "free_only"; we normalize to price_free
                                    price_free: !!(a.free_only || a.price_free)
                                };
                            }
                        }

                        // --- Attraction ----------------------------------------------------
                        if (adv.attraction)
                        {
                            ADV_FILTERS.attraction = ADV_FILTERS.attraction ||
                            {
                                culture:
                                {},
                                nature:
                                {},
                                recreation:
                                {}
                            };

                            if (adv.attraction.culture)
                            {
                                ADV_FILTERS.attraction.culture = {
                                    ...ADV_FILTERS.attraction.culture,
                                    ...adv.attraction.culture
                                };
                            }
                            if (adv.attraction.nature)
                            {
                                ADV_FILTERS.attraction.nature = {
                                    ...ADV_FILTERS.attraction.nature,
                                    ...adv.attraction.nature
                                };
                            }
                            if (adv.attraction.recreation)
                            {
                                ADV_FILTERS.attraction.recreation = {
                                    ...ADV_FILTERS.attraction.recreation,
                                    ...adv.attraction.recreation
                                };
                            }
                        }

                        // --- Store (kinds + brand) ----------------------------------------
                        if (adv.store)
                        {
                            ADV_FILTERS.store = ADV_FILTERS.store ||
                            {
                                kinds:
                                {},
                                brand: ""
                            };

                            const incomingKinds = adv.store.kinds ||
                            {};
                            const dstKinds = ADV_FILTERS.store.kinds;
                            Object.keys(incomingKinds).forEach(k =>
                            {
                                dstKinds[k] = !!incomingKinds[k];
                            });

                            ADV_FILTERS.store.brand = (adv.store.brand || "").trim();
                        }

                        // --- Parking -------------------------------------------------------
                        if (adv.parking)
                        {
                            ADV_FILTERS.parking = {
                                ...ADV_FILTERS.parking,
                                ...adv.parking
                            };
                        }

                        // --- Food (kinds + diet) ------------------------------------------
                        if (adv.food)
                        {
                            ADV_FILTERS.food = ADV_FILTERS.food ||
                            {
                                kinds:
                                {},
                                diet:
                                {
                                    vegan: false,
                                    vegetarian: false
                                }
                            };

                            if (adv.food.kinds)
                            {
                                ADV_FILTERS.food.kinds = {
                                    ...ADV_FILTERS.food.kinds,
                                    ...adv.food.kinds
                                };
                            }
                            if (adv.food.diet)
                            {
                                ADV_FILTERS.food.diet = {
                                    ...ADV_FILTERS.food.diet,
                                    vegan: !!adv.food.diet.vegan,
                                    vegetarian: !!adv.food.diet.vegetarian
                                };
                            }
                        }

                        // --- Terminal (modes + wheelchair) --------------------------------
                        if (adv.terminal)
                        {
                            const m = adv.terminal.modes ||
                            {};
                            ADV_FILTERS.terminal = {
                                ...(ADV_FILTERS.terminal ||
                                {}),
                                modes:
                                {
                                    ...(ADV_FILTERS.terminal ? (ADV_FILTERS.terminal.modes ||
                                    {}) :
                                    {}),
                                    rail: !!m.rail,
                                    bus: !!m.bus,
                                    ferry: !!m.ferry,
                                    airport: !!m.airport,
                                    platform: !!m.platform
                                },
                                wheelchair: !!adv.terminal.wheelchair
                            };
                        }

                        // --- RV ------------------------------------------------------------
                        if (adv.rv)
                        {
                            ADV_FILTERS.rv = {
                                ...(ADV_FILTERS.rv ||
                                {}),
                                dump: !!adv.rv.dump,
                                water: !!adv.rv.water,
                                power: !!adv.rv.power,
                                showers: !!adv.rv.showers,
                                toilets: !!adv.rv.toilets,
                                free_only: !!adv.rv.free_only
                            };
                        }

                        // --- Wildcamp ------------------------------------------------------
                        if (adv.wildcamp)
                        {
                            ADV_FILTERS.wildcamp = {
                                ...(ADV_FILTERS.wildcamp ||
                                {}),
                                allow_informal: !!adv.wildcamp.allow_informal,
                                only_basic: !!adv.wildcamp.only_basic
                            };
                        }

                        if (DEBUG) console.info("[CT_POI] setAdvFilters", ADV_FILTERS);
                        refetch();
                    },


                    setClusterOptions: (opts = {}) =>
                    {
                        const tooOld = isTooOldForCluster();
                        CLUSTER_ENABLE = !!opts.enable && !tooOld;
                        CLUSTER_DISABLE_AT_ZOOM = Number(opts.disableAtZoom ?? CLUSTER_DISABLE_AT_ZOOM);
                        if (tooOld && opts.enable) console.warn("[CT_POI] setClusterOptions: Leaflet too old; forcing OFF.");
                        if (DEBUG) console.info("[CT_POI] setClusterOptions",
                        {
                            CLUSTER_ENABLE,
                            CLUSTER_DISABLE_AT_ZOOM
                        });
                        (CLUSTER_ENABLE ? ensureMarkerClusterLib() : Promise.resolve()).then(() =>
                        {
                            rebuildLayerGroups();
                            refetch();
                        });
                    },

                    setActiveFn: (fn) =>
                    {
                        if (typeof fn === "function") _isActiveFn = fn;
                    },
                    pokeActivity: () =>
                    {
                        const cur = _isActiveSafe();
                        if (cur) refetch();
                        else clearAll();
                    },

                    setTemplate: (cat, fn) =>
                    {
                        if (typeof fn === "function") POPUP_TEMPLATES[cat] = fn;
                    },
                    setSearchBuilder: (cat, fn) =>
                    {
                        if (typeof fn === "function") SEARCH_BUILDERS[cat] = fn;
                    }
                };
            })();

            try
            {
                unsafeWindow.CT_POI = CT_POI;
            }
            catch (_)
            {
                window.CT_POI = CT_POI;
            }
            return CT_POI;
        }
    console.log("[TCA2] [features/poi.js] Ready");
  } catch (e) {
    console.error("[TCA2] [features/poi.js] Error during module execution", e);
  }
})();
