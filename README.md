# The Cachetur Assitant V2 (fully split)

This package contains a bootloader userscript and modularized files with **legacy code moved into the appropriate modules**:
- Page detection → `core/page-detect.js`
- i18n init → `core/i18n.js`
- App flow (ctStart/ctPreInit/ctCheckLogin/ctApiCall) → `app/ct-start.js`
- Header/UX for not-logged-in (ctInitNotLoggedIn) → `features/header-gc.js`
- D/T info (tvinfostart/tvinfo) → `features/dt-info.js`
- POI/Overpass (createCT_POI) → `features/poi.js`
- Remaining helpers/constants/styles → `features/misc.js`

All logs are in English and prefixed with **[TCA2]**.
Bootloader name: **The Cachetur Assitant V2**, version `0.0.0.1`.

Update the `REPO` in the userscript and publish these files to GitHub.
