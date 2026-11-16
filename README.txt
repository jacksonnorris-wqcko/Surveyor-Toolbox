Surveyor’s Toolbox — iPhone PWA v8.6
Built By Jackson 2026

v8.6 is a complete visual redesign of the Surveyor’s Toolbox interface. The new field-workstation design updates the desktop sidebar, top bar, dashboard, calculator panels, forms, result cards, tables, job lists, point manager, strata workspace, overlays, and iPhone navigation. Existing calculator behaviour, element IDs, localStorage keys, saved jobs, points, and backup/restore workflows are retained.

v8.5 removed the standalone Traverse and Area calculators. Quick Close remains available for known-line entry and closing calculations.

The automatic updater remains enabled. The app checks for a new service worker on open, when returning to the foreground, and when connectivity returns. Updated builds activate automatically and reload once. Network-first page loading keeps GitHub Pages releases fresh; the last cached app shell remains available offline. User jobs and points remain in localStorage and are not cleared by app updates.

Deploy every file from this folder to the repository root on the main branch, including sw.js and v8-workspace.js. Keep manifest.json and icons. The update check requires HTTPS (GitHub Pages is supported).