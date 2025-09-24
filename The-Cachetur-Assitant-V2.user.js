// ==UserScript==
// @name            The Cachetur Assitant V2
// @namespace       https://cachetur.no/
// @version         0.2.4
// @description     Bootloader that loads TCA2 modules live from GitHub and wires jQuery + i18n
// @icon            https://cachetur.net/img/logo_top.png
// @match           *://www.geocaching.com/*
// @match           *://geocaching.com/*
// @match           *://project-gc.com/*
// @match           *://www.project-gc.com/*
// @match           *://cachetur.no/*
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
// @grant           GM_xmlhttpRequest
// @grant           GM.xmlHttpRequest
// @grant           GM_info
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_openInTab
// @grant           GM_registerMenuCommand
// @grant           GM_addStyle
// @grant           unsafeWindow
// @connect         raw.githubusercontent.com
// @connect         github.com
// @connect         cachetur.no
// @connect         www.cachetur.no
// @connect         cachetur.net
// @run-at          document-end
// @require         https://code.jquery.com/jquery-latest.js
// @require         https://unpkg.com/i18next@22.4.9/i18next.min.js
// @require         https://unpkg.com/i18next-browser-languagedetector@7.0.1/i18nextBrowserLanguageDetector.js
// ==/UserScript==

(function() {
  'use strict';
  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  // --- Config: GitHub repo to fetch modules from
  const REPO = { owner: "cghove", name: "The-CacheturAssistant-2", branch: "main" };

  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log = TCA2.log || console;

  // Simple helper to pick GM xhr (support both legacy and modern names)
  const gmXHR = (typeof GM !== 'undefined' && GM.xmlHttpRequest) || (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest);

  // Basic page detection up front for logging
  const href = location.href;
  const isGCMap = /geocaching\.com\/(map|play\/map)/i.test(href);
  const isGCListing = /geocaching\.com\/(geocache|seek\/cache_details\.aspx)/i.test(href);
  const isPGC = /project-gc\.com/i.test(href);
  const isCachetur = /cachetur\.(no|net)/i.test(href);

  function urlRaw(path) {
    return `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${REPO.branch}/${path}`;
  }

  function fetchText(url) {
    return new Promise((resolve, reject) => {
      if (!gmXHR) return reject(new Error("GM xmlHttpRequest missing"));
      gmXHR({
        method: "GET",
        url,
        responseType: "text",
        onload: (res) => (res.status >= 200 && res.status < 300) ? resolve(res.responseText) : reject(new Error(`HTTP ${res.status} for ${url}`)),
        onerror: (e) => reject(e),
        ontimeout: () => reject(new Error("Timeout"))
      });
    });
  }

  async function loadManifest() {
    const m = await fetchText(urlRaw("manifest.json"));
    return JSON.parse(m);
  }

  function gmEval(code, name) {
    // Eval in userscript sandbox (not page)
    try {
      eval(code + `\n//# sourceURL=${name}`);
    } catch (e) {
      log.error("[TCA2] Eval error for", name, e);
      throw e;
    }
  }

  async function loadModule(entry) {
    const code = await fetchText(urlRaw(entry.path));
    gmEval(code, entry.path);
  }

  async function bootstrap() {
    log.info("[TCA2] Bootloader: starting", {repo: REPO, url: location.href});
    log.info("[TCA2] Bootloader: Detecting page…", {isGCMap, isGCListing, isPGC, isCachetur, href});

    // Expose quick flags so modules can read immediately
    TCA2.page = { isGCMap, isGCListing, isPGC, isCachetur, href };

    try {
      const manifest = await loadManifest();
      log.info("[TCA2] Bootloader: Loaded manifest.json", manifest);

      // Always load in the declared order
      for (const mod of manifest.modules) {
        log.info("[TCA2] Bootloader: Loading", {path: mod.path, when: mod.when});
        await loadModule(mod);
      }
      log.info("[TCA2] Bootloader: Done");
    } catch (e) {
      log.error("[TCA2] Bootloader failed:", e);
    }
  }

  bootstrap();
})();
