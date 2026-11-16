Surveyor’s Toolbox — iPhone PWA v8.7
Built By Jackson 2026

v8.7 fixes Quick Close line entry by restoring its line counter, which was accidentally removed during the v8.5 calculator cleanup. The permanent desktop Point Manager sidebar shortcut introduced in v8.6 has been removed; Point Manager remains available from the existing dashboard tool and iPhone More menu.

v8.6 introduced the visual redesign across desktop and iPhone, including the evergreen field-workstation theme, refreshed navigation, dashboard, calculator panels, forms, result cards, tables, job lists, point manager, strata workspace and overlays.

The standalone Traverse and Area calculators remain removed. Quick Close, B&D calculators, Strata Areas, Point Manager, Saved Jobs, Scale, Conversions, and existing local data are retained.

The automatic updater remains enabled. The app checks for a new service worker on open, when returning to the foreground, and when connectivity returns. Updated builds activate automatically and reload once. Network-first page loading keeps GitHub Pages releases fresh; the last cached app shell remains available offline. User jobs and points remain in localStorage and are not cleared by app updates.

Deploy every file from this folder to the repository root on the main branch, including sw.js and v8-workspace.js. Keep manifest.json and icons. The update check requires HTTPS (GitHub Pages is supported).