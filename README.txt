Surveyor’s Toolbox — iPhone PWA v8.9
Built By Jackson 2026

v8.9 adds editable mark names for Points A, B and C in B&D from Coords, and a dedicated Print Calculation report. The printout lists each point's mark name and Easting/Northing, then the line bearings, grid distances, scale-factor-adjusted distances and coordinate differences, plus a coordinate-proportioned line diagram. The report is generated from the current inputs. Swapping A and B also swaps their mark names.

v8.8 adds an optional Point C to B&D from Coords. With Point C enabled, the calculator reports all three survey-mark lines: A→B, B→C and C→A. The scale-factor control multiplies each calculated grid distance and displays both the original grid distance and adjusted distance. The existing two-point A→B calculation remains the default.

v8.7 fixes Quick Close line entry by restoring its line counter, which was accidentally removed during the v8.5 calculator cleanup. The permanent desktop Point Manager sidebar shortcut introduced in v8.6 has been removed; Point Manager remains available from the existing dashboard tool and iPhone More menu.

v8.6 introduced the visual redesign across desktop and iPhone, including the evergreen field-workstation theme, refreshed navigation, dashboard, calculator panels, forms, result cards, tables, job lists, point manager, strata workspace and overlays.

The standalone Traverse and Area calculators remain removed. Quick Close, B&D calculators, Strata Areas, Point Manager, Saved Jobs, Scale, Conversions, and existing local data are retained.

The automatic updater remains enabled. The app checks for a new service worker on open, when returning to the foreground, and when connectivity returns. Updated builds activate automatically and reload once. Network-first page loading keeps GitHub Pages releases fresh; the last cached app shell remains available offline. User jobs and points remain in localStorage and are not cleared by app updates.

Deploy every file from this folder to the repository root on the main branch, including sw.js and v8-workspace.js. Keep manifest.json and icons. The update check requires HTTPS (GitHub Pages is supported).
