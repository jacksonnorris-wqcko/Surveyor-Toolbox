Surveyor’s Toolbox — iPhone PWA v8.5
Built By Jackson 2026

v8.5 removes the standalone Traverse and Area calculators from the app interface, dashboard shortcuts, and iPhone navigation. Quick Close remains available for entering known boundary lines and calculating the closing bearing and distance. Strata Areas, B&D calculators, Point Manager, Saved Jobs, Scale, Conversions, and the existing local data are retained.

The automatic updater remains enabled. The app checks for a new service worker on open, when returning to the foreground, and when connectivity returns. Updated builds activate automatically and reload once. Network-first page loading keeps GitHub Pages releases fresh; the last cached app shell remains available offline. User jobs and points remain in localStorage and are not cleared by app updates.

Deploy every file from this folder to the repository root on the main branch, including sw.js and v8-workspace.js. Keep manifest.json and icons. The update check requires HTTPS (GitHub Pages is supported).