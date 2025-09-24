// ==UserScript==
// @name            The Cachetur Assistant V2 – Bootloader
// @namespace       https://cachetur.no/
// @version         0.2.0
// @description     Bootloader that loads TCA2 modules live from GitHub (jQuery-first)
// @icon            https://cachetur.net/img/logo_top.png
// @match           *://www.geocaching.com/*
// @match           *://geocaching.com/*
// @match           *://project-gc.com/*
// @match           *://www.project-gc.com/*
// @match           *://cachetur.no/*
// @match           *://www.cachetur.no/*
// @match           *://cachetur.net/*
// @connect         raw.githubusercontent.com
// @connect         github.com
// @connect         cachetur.no
// @connect         www.cachetur.no
// @connect         cachetur.net
// @connect         www.cachetur.net
// @grant           GM_xmlhttpRequest
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_addStyle
// @grant           GM_registerMenuCommand
// @grant           GM_info
// @grant           unsafeWindow
// @run-at          document-start
// @require         https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==

(function() {
  "use strict";

  const REPO = { owner: "cghove", name: "The-CacheturAssistant-2", branch: "main" };
  const RAW = (path) => `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${REPO.branch}/${path}`;

  // Promote jQuery globally ASAP (for legacy modules)
  try {
    if (typeof window.jQuery === "undefined" && typeof window.$ === "undefined" && typeof jQuery !== "undefined") {
      window.jQuery = jQuery;
      window.$ = jQuery;
    }
  } catch(e) {}

  const log = (...a) => console.log("[TCA2] Bootloader:", ...a);
  const warn = (...a) => console.warn("[TCA2] Bootloader:", ...a);
  const err  = (...a) => console.error("[TCA2] Bootloader:", ...a);

  // Tiny ajax helper via GM_xmlhttpRequest
  function gmGet(url, {responseType="text"}={}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText || res.response);
          else reject(new Error(`HTTP ${res.status} for ${url}`));
        },
        onerror: (e) => reject(new Error(`Network error for ${url}`)),
      });
    });
  }

  // Minimal page detector; expanded logic lives in core/page-detect.js
  function detectPage(url = location.href) {
    return {
      isGCMap: /geocaching\.com\/(map|play\/map|live\/play\/map)/i.test(url),
      isGCListing: /geocaching\.com\/(geocache|seek\/cache_details\.aspx)/i.test(url),
      isPGC: /project-gc\.com/i.test(url),
      isCachetur: /cachetur\.(no|net)/i.test(url),
      href: url
    };
  }

  async function loadManifest() {
    const raw = await gmGet(RAW("manifest.json"));
    return JSON.parse(raw);
  }

  async function loadModule(path) {
    const url = RAW(path);
    const code = await gmGet(url);
    // Provide module context/globals commonly expected by legacy code
    const context = {
      REPO, RAW, GM_getValue, GM_setValue, GM_addStyle, GM_registerMenuCommand,
      $, jQuery: window.jQuery || window.$, unsafeWindow
    };
    // eslint-disable-next-line no-new-func
    const wrapped = new Function("module", "exports", ...Object.keys(context),
      `/* TCA2 module: ${path} */\n` +
      `"use strict";\n` +
      `${code}\n` +
      `return (typeof module !== "undefined" && module.exports) ? module.exports : (typeof exports !== "undefined" ? exports : undefined);`
    );
    const module = { exports: {} };
    return wrapped(module, module.exports, ...Object.values(context));
  }

  async function run() {
    const page = detectPage();
    log("starting", { repo: REPO, url: page.href });
    log("Detecting page…", page);
    try {
      const manifest = await loadManifest();
      log("Loaded manifest.json", manifest);

      // Make a simple event bus & env visible early so modules can subscribe
      const bus = $({});
      const env = {
        REPO,
        RAW,
        page,
        bus,
        get: GM_getValue,
        set: GM_setValue,
        $: window.jQuery || window.$
      };
      unsafeWindow.TCA2 = env;
      window.TCA2 = env;

      for (const mod of manifest.modules) {
        if (mod.when && mod.when.path && mod.when.path.length) {
          const match = mod.when.path.some(rx => new RegExp(rx, "i").test(location.href));
          if (!match) continue;
        }
        log("Loading", mod);
        await loadModule(mod.path);
      }

      bus.trigger("tca2:ready", [env]);
      log("Done");
    } catch (e) {
      err("Boot failed:", e);
    }
  }

  // Run as soon as possible
  run();
})();