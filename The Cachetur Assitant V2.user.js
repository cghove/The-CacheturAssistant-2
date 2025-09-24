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
// @grant           GM_xmlhttpRequest
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
// @connect         cachetur.net
// @connect         overpass-api.de
// @connect         overpass.kumi.systems
// @connect         overpass.openstreetmap.fr
// @connect         overpass.osm.ch
// @connect         nominatim.openstreetmap.org
// @connect         photon.komoot.io
// @run-at          document-end
// @require         https://code.jquery.com/jquery-latest.js
// @require         https://unpkg.com/i18next@22.4.9/i18next.min.js
// @require         https://unpkg.com/i18next-xhr-backend@3.2.2/i18nextXHRBackend.js
// @require         https://unpkg.com/i18next-browser-languagedetector@7.0.1/i18nextBrowserLanguageDetector.js
// ==/UserScript==

(function () {
  'use strict';

  // Repo to load modules from
  var REPO = { owner: "cghove", name: "The-CacheturAssistant-2", branch: "main" };

  const root = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  const TCA2 = root.TCA2 = root.TCA2 || {};
  TCA2.repo = REPO;
  TCA2.log = TCA2.log || console;

  // Make sure jQuery is globally available
  if (typeof root.$ === 'undefined' && typeof root.jQuery !== 'undefined') {
    root.$ = root.jQuery;
  }

  function gmFetch(url, opts={}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: opts.method || 'GET',
        url,
        headers: opts.headers || {},
        data: opts.data || null,
        responseType: opts.responseType || 'text',
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error('HTTP ' + res.status + ' for ' + url));
        },
        onerror: (e) => reject(new Error('Network error for ' + url)),
        ontimeout: () => reject(new Error('Timeout for ' + url))
      });
    });
  }

  function gmEval(source, pathLabel) {
    // evaluate in page context; add sourceURL for easier debugging
    const wrapped = source + "\n//# sourceURL=" + pathLabel;
    (0, eval)(wrapped); // eslint-disable-line no-eval
  }

  async function loadModule(path, when) {
    const baseUrl = 'https://raw.githubusercontent.com/' + REPO.owner + '/' + REPO.name + '/' + REPO.branch + '/modules/';
    const url = baseUrl + path;
    TCA2.log.info('[TCA2] Bootloader: Loading', { path, when });
    const code = await gmFetch(url);
    gmEval(code, path);
  }

  async function bootstrap() {
    try {
      const href = location.href;
      const pageInfo = {
        isGCMap: /geocaching\.com\/(play\/)?map/.test(href),
        isGCListing: /geocaching\.com\/(geocache|seek\/cache_details)/.test(href),
        isPGC: /project-gc\.com/.test(href),
        isCachetur: /cachetur\.no/.test(href),
        href
      };
      TCA2.page = Object.assign({}, TCA2.page || {}, pageInfo);

      TCA2.log.info('[TCA2] Bootloader: starting', {repo: REPO, url: href});
      TCA2.log.info('[TCA2] Bootloader: Detecting page…', pageInfo);

      const manifestUrl = 'https://raw.githubusercontent.com/' + REPO.owner + '/' + REPO.name + '/' + REPO.branch + '/modules/manifest.json';
      const manifestText = await gmFetch(manifestUrl);
      const manifest = JSON.parse(manifestText);
      TCA2.log.info('[TCA2] Bootloader: Loaded manifest.json', manifest);

      for (const mod of manifest.modules) {
        await loadModule(mod.path, mod.when);
      }

      TCA2.log.info('[TCA2] Bootloader: Done');
    } catch (err) {
      TCA2.log.error('[TCA2] Bootloader: failed', err);
    }
  }

  bootstrap();
})();