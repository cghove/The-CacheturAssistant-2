// ==UserScript==
// @name            The Cachetur Assitant V2
// @namespace       https://cachetur.no/
// @version         0.2.0
// @description     Bootloader that loads TCA2 modules live from GitHub
// @icon            https://cachetur.net/img/logo_top.png
// @match           https://www.geocaching.com/play/map*
// @match           http://www.geocaching.com/play/map*
// @match           https://www.geocaching.com/map/*
// @match           http://www.geocaching.com/map/*
// @match           https://www.geocaching.com/live/play/map*
// @match           http://www.geocaching.com/live/play/map*
// @match           https://www.geocaching.com/geocache/*
// @match           http://www.geocaching.com/geocache/*
// @match           https://www.geocaching.com/seek/cache_details.aspx*
// @match           https://www.geocaching.com/plan/*
// @match           https://www.geocaching.com/play/geotours*
// @match           http://project-gc.com/*
// @match           https://project-gc.com/*
// @match           http*://cachetur.no/bobilplasser
// @connect         overpass-api.de
// @connect         overpass.kumi.systems
// @connect         overpass.openstreetmap.fr
// @connect         overpass.osm.ch
// @connect         nominatim.openstreetmap.org
// @connect         photon.komoot.io
// @connect         www.cachetur.no
// @connect         www.cachetur.net
// @connect         cachetur.no
// @connect         cachetur.net
// @connect         raw.githubusercontent.com
// @connect         github.com
// @connect         self
// @grant           GM_xmlhttpRequest
// @grant           GM_info
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_openInTab
// @grant           GM_registerMenuCommand
// @grant           GM_addStyle
// @grant           unsafeWindow
// @require         https://code.jquery.com/jquery-latest.js
// @require         https://unpkg.com/i18next@22.4.9/i18next.min.js
// @run-at          document-end
// @copyright       2017+, cachetur.no
// ==/UserScript==

(function() {
  'use strict';

  // Repository config
  var REPO = { owner: "cghove", name: "The-CacheturAssistant-2", branch: "main" };
  var RAW_BASE = "https://raw.githubusercontent.com/" + REPO.owner + "/" + REPO.name + "/" + REPO.branch + "/";

  // Logger
  function log() { console.log.apply(console, ["[TCA2] Bootloader:"].concat([].slice.call(arguments))); }
  function warn() { console.warn.apply(console, ["[TCA2] Bootloader:"].concat([].slice.call(arguments))); }
  function error() { console.error.apply(console, ["[TCA2] Bootloader:"].concat([].slice.call(arguments))); }

  // Minimal page detection used by the bootloader (modules do their own too)
  function detectPage() {
    var href = location.href;
    var host = location.host;
    var isGC = /(^|\.)geocaching\.com$/i.test(host);
    var isPGC = /(^|\.)project-gc\.com$/i.test(host);
    var isCachetur = /(^|\.)cachetur\.(no|net)$/i.test(host);
    var isGCMap = isGC && /(\/map(\/|#|\?|$)|\/play\/map)/i.test(href);
    var isGCListing = isGC && /(\/geocache\/|\/seek\/cache_details\.aspx)/i.test(href);
    return { isGCMap: isGCMap, isGCListing: isGCListing, isPGC: isPGC, isCachetur: isCachetur, href: href };
  }
  var PAGE = detectPage();

  // GM GET helper
  function gmGet(url, opts) {
    return new Promise(function(resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        responseType: (opts && opts.responseType) || 'text',
        anonymous: (opts && typeof opts.anonymous !== 'undefined') ? opts.anonymous : false,
        onload: function(resp) {
          if (resp.status >= 200 && resp.status < 300) {
            resolve(resp.responseText);
          } else {
            reject(new Error("HTTP " + resp.status + " for " + url));
          }
        },
        onerror: function() { reject(new Error("Request failed for " + url)); },
        ontimeout: function() { reject(new Error("Request timeout for " + url)); }
      });
    });
  }

  function buildURL(path) {
    path = String(path).replace(/^\/+/, '');
    return RAW_BASE + path;
  }

  function gmEval(src, urlForDebug) {
    // Evaluate module code in the userscript sandbox
    // Attach a sourceURL for easier debugging
    try {
      (0, eval)(src + "\n//# sourceURL=" + urlForDebug);
    } catch (e) {
      throw e;
    }
  }

  function shouldLoad(when) {
    if (!when) return true;
    // only simple equality checks expected (e.g. { isGCMap: true })
    var ok = true;
    Object.keys(when).forEach(function(k) {
      if (PAGE.hasOwnProperty(k)) {
        ok = ok && (String(PAGE[k]) === String(when[k]));
      }
    });
    return ok;
  }

  async function loadModule(entry) {
    log("Loading", { path: entry.path, when: entry.when });
    var url = buildURL(entry.path);
    var code = await gmGet(url);
    gmEval(code, url);
  }

  async function run() {
    log("starting", {repo: REPO, url: location.href});
    log("Detecting page…", PAGE);

    // Load manifest
    var manifestUrl = buildURL("manifest.json");
    var manifestTxt = await gmGet(manifestUrl);
    var manifest;
    try {
      manifest = JSON.parse(manifestTxt);
    } catch (e) {
      error("Failed to parse manifest.json", e);
      return;
    }
    log("Loaded manifest.json", manifest);

    // Load modules in order, filtering by `when`
    for (var i = 0; i < manifest.modules.length; i++) {
      var m = manifest.modules[i];
      if (shouldLoad(m.when)) {
        try {
          await loadModule(m);
        } catch (e) {
          error("Module failed", m.path, e);
        }
      }
    }

    log("Done");
  }

  run().catch(function(e) {
    error("Boot failed:", e);
  });

})();
