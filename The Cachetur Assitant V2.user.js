// ==UserScript==
// @name            The Cachetur Assitant V2
// @namespace       https://cachetur.no/
// @version         0.2.0
// @description     Bootloader that loads TCA2 modules live from GitHub
// @icon            https://cachetur.net/img/logo_top.png
// @match           *://www.geocaching.com/*
// @match           *://geocaching.com/*
// @match           *://project-gc.com/*
// @match           *://www.project-gc.com/*
// @match           *://cachetur.no/*
// @match           *://www.cachetur.no/*
// @connect         raw.githubusercontent.com
// @connect         github.com
// @connect         cachetur.no
// @connect         www.cachetur.no
// @connect         overpass-api.de
// @connect         overpass.kumi.systems
// @connect         overpass.openstreetmap.fr
// @connect         overpass.osm.ch
// @connect         nominatim.openstreetmap.org
// @connect         photon.komoot.io
// @grant           GM_xmlhttpRequest
// @grant           GM_info
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_openInTab
// @grant           GM_registerMenuCommand
// @grant           GM_addStyle
// @grant           unsafeWindow
// @run-at          document-end
// @require         https://code.jquery.com/jquery-latest.js
// @require         https://unpkg.com/i18next@22.4.9/i18next.min.js
// @require         https://unpkg.com/i18next-xhr-backend@3.2.2/i18nextXHRBackend.js
// @require         https://unpkg.com/i18next-browser-languagedetector@7.0.1/i18nextBrowserLanguageDetector.js
// @require         https://gist.github.com/raw/2625891/waitForKeyElements.js
// ==/UserScript==

(function() {
  'use strict';

  // Repo to load from:
  var REPO = { owner: "cghove", name: "The-CacheturAssistant-2", branch: "main" };

  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  const log = TCA2.log = {
    info: (...a)=>console.log('[TCA2]', ...a),
    warn: (...a)=>console.warn('[TCA2]', ...a),
    error: (...a)=>console.error('[TCA2]', ...a),
  };

  // Expose jQuery globally (several legacy modules expect it)
  try {
    root.$ = root.jQuery = root.jQuery || jQuery || $;
  } catch(e) {
    // Tampermonkey @require should have provided it, but keep running even if not
    log.warn('jQuery not available; some legacy modules may fail.');
  }

  function detectPage() {
    const href = location.href;
    const host = location.hostname;
    const isGC = /geocaching\.com$/i.test(host) || /(^|\.)geocaching\.com$/i.test(host);
    const isPGC = /project-gc\.com$/i.test(host);
    const isCachetur = /cachetur\.(no|net)$/i.test(host);
    const isGCMap = isGC && /\/(play\/map|map\/?#)/i.test(href);
    const isGCListing = isGC && /\/geocache\//i.test(href);
    return { href, isGC, isPGC, isCachetur, isGCMap, isGCListing, site: isGC ? 'gc' : (isPGC ? 'pgc' : (isCachetur ? 'cachetur' : 'other')) };
  }

  function shouldLoad(when, page) {
    if (!when) return true;
    if (when.isGCMap && !page.isGCMap) return false;
    if (when.isGCListing && !page.isGCListing) return false;
    if (when.site && when.site !== page.site) return false;
    return true;
  }

  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + REPO.owner + '/' + REPO.name + '/' + REPO.branch + '/' + path;
  }

  function gmFetchText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { 'Accept': 'text/plain' },
        onload: function(resp) {
          if (resp.status >= 200 && resp.status < 300) resolve(resp.responseText);
          else reject(new Error('HTTP ' + resp.status + ' for ' + url));
        },
        onerror: function(err) { reject(err); }
      });
    });
  }

  function gmFetchJSON(url) {
    return gmFetchText(url).then(txt => {
      try { return JSON.parse(txt); } catch(e) { throw new Error('Invalid JSON from ' + url); }
    });
  }

  function gmEval(code, name) {
    // Evaluate module in the userscript sandbox and add a sourceURL for debugging
    try {
      // eslint-disable-next-line no-eval
      eval(code + '\n//# sourceURL=' + name);
    } catch(e) {
      log.error('Module error in', name, e);
      throw e;
    }
  }

  async function run() {
    const page = detectPage();
    log.info('Bootloader: starting', {repo: REPO, url: page.href});
    log.info('Bootloader: Detecting page…', page);

    // Make page flags also available for legacy code
    root._ctPage = (page.isGCMap ? 'gc_map_new'
                   : page.isGCListing ? 'gc_geocache'
                   : page.isPGC ? 'pgc'
                   : page.isCachetur ? 'cachetur'
                   : 'other');

    // Load manifest
    const manifestUrl = rawUrl('manifest.json');
    const manifest = await gmFetchJSON(manifestUrl);
    log.info('Bootloader: Loaded manifest.json', manifest);

    // Sequentially load modules in manifest order
    for (const mod of manifest.modules) {
      if (!mod || !mod.path) continue;
      if (!shouldLoad(mod.when, page)) continue;
      log.info('Bootloader: Loading', {path: mod.path, when: mod.when});
      const url = rawUrl(mod.path);
      const code = await gmFetchText(url);
      gmEval(code, mod.path);
    }

    log.info('Bootloader: Done');
  }

  // Kick off
  run().catch(err => {
    log.error('Bootloader failed', err);
  });
})();