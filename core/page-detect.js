// [TCA2] core/page-detect.js
// This module was split from the original monolithic userscript. All logs are in English.
(function() {
  try {
    console.log("[TCA2] [core/page-detect.js] Loaded");


    function ctDetectPage()
    {
        const host = (window.location.hostname || "").toLowerCase();
        const path = (window.location.pathname || "").toLowerCase();
        const search = (window.location.search || "").toLowerCase();

        // Geocaching.com (with/without www)
        if (host === "geocaching.com" || host === "www.geocaching.com")
        {
            if (path.includes("/seek/") || path.includes("/geocache/")) return "gc_geocache";
            if (path.includes("/plan/lists") || path.includes("/plan/")) return "gc_bmlist";
            if (path === "/map" || path.includes("/map/")) return "gc_map";
            if (path.includes("/live/play/map") || path.includes("/play/map")) return "gc_map_new";
            if (path.includes("/play/geotours")) return "gc_gctour";
        }

        // cachetur.no (all subdomains)
        if (host.endsWith("cachetur.no"))
        {
            if (/^\/bobilplasser\/?/.test(path)) return "bobil";
            if (/^\/fellestur\/?/.test(path)) return "fellestur";
        }

        // Project-GC (with/without www) – case-insensitive
        if (host === "project-gc.com" || host === "www.project-gc.com")
        {
            if (path.includes("/user/virtualgps") && !search.includes("map=")) return "pgc_vgps";
            if (path.includes("/livemap/") || path.includes("/tools/")) return "pgc_map";
            if (path.includes("/maps/")) return "pgc_map2";

        }

        return "unknown";
    }
    console.log("[TCA2] [core/page-detect.js] Ready");
  } catch (e) {
    console.error("[TCA2] [core/page-detect.js] Error during module execution", e);
  }
})();
