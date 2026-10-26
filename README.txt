Surveyor’s Toolbox — iPhone PWA v8.4
Built By Jackson 2026

v8.4 adds automatic app updates: the app checks for a new service worker on open, when returning to the foreground, and when connectivity returns. Updated builds activate automatically and reload once. Network-first page loading keeps GitHub Pages releases fresh; the last cached app shell remains available offline. User jobs and points remain in localStorage and are not cleared by app updates.

Deploy every file from this folder to the repository root on the main branch, including sw.js and v8-workspace.js. Keep manifest.json and icons. The update check requires HTTPS (GitHub Pages is supported). On the first launch after deploying this updater, the browser may need one normal refresh to install it; subsequent releases should update automatically.
