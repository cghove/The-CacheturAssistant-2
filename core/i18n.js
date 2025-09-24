/* core/i18n.js */
(function() {
  const log = (...a) => console.log("[TCA2] [core/i18n.js]", ...a);
  const warn = (...a) => console.warn("[TCA2] [core/i18n.js]", ...a);
  const $ = window.jQuery || window.$;

  const I18NEXT_URL = "https://unpkg.com/i18next@22.4.9/i18next.min.js";
  const XHR_URL     = "https://unpkg.com/i18next-xhr-backend@3.2.2/i18nextXHRBackend.js";
  const DETECT_URL  = "https://unpkg.com/i18next-browser-languagedetector@7.0.1/i18nextBrowserLanguageDetector.js";

  function inject(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  function getCookie(name, cookieStr) {
    const v = ("; " + cookieStr).split("; " + name + "=");
    if (v.length === 2) return v.pop().split(";").shift();
  }

  // Try Cachetur API cookie first (user setting), else GM, else browser
  function resolveLanguage() {
    try {
      // If cachetur.no cookie is present in document.cookie when on cachetur pages:
      const cookieLang = getCookie("cachetur_lang", document.cookie || "");
      if (cookieLang) return cookieLang.replace("_", "-");
    } catch(e) {}

    try {
      const gmLang = (typeof GM_getValue === "function" && GM_getValue("tca2_lang")) || null;
      if (gmLang) return gmLang;
    } catch(e) {}

    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    return (nav || "en").replace("_", "-");
  }

  async function init() {
    await inject(I18NEXT_URL);
    await inject(XHR_URL);
    await inject(DETECT_URL);

    const lng = resolveLanguage();
    window.TCA2 = window.TCA2 || {};
    window.TCA2.language = lng;

    // Configure i18next to load from cachetur.no
    // Path format: https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json
    // Namespaces: ["common"]
    const loadPath = "https://cachetur.no/monkey/language/{{ns}}.{{lng}}.json";

    // eslint-disable-next-line no-undef
    i18next
      // eslint-disable-next-line no-undef
      .use(i18nextXHRBackend)
      // eslint-disable-next-line no-undef
      .use(i18nextBrowserLanguageDetector)
      .init({
        fallbackLng: "en",
        lng,
        ns: ["common"],
        defaultNS: "common",
        backend: { loadPath },
        detection: { order: ["querystring", "cookie", "navigator"], caches: [] },
        returnEmptyString: false,
      }, function(err) {
        if (err) warn("i18next init error:", err);
        else log("Ready (lng=" + i18next.language + ")");
        $(function(){ $(document).trigger("tca2:i18n-ready", [i18next]); });
      });
  }

  init().catch(e => warn("init failed", e));
})();