Surveyor’s Toolbox — iPhone PWA v9.0
Built By Jackson 2026

v9.0 is a complete visual reskin of the Surveyor’s Toolbox. It introduces a custom inline SVG icon library, a refreshed forest-green and brass visual identity, redesigned desktop sidebar and mobile navigation, updated typography and spacing, consistent cards, forms, result panels, tables and buttons, and page-specific styling for Home, Point Manager, B&D calculators, Quick Close, Saved Jobs, Scale, Conversions, Shortcuts and Strata Areas. Saved-job and point-list actions use matching custom icons. This release is presentation-focused: calculator logic, saved job/point storage formats, existing IDs, print and DXF exporters, and workflows are retained.

v8.15 fixes the Saved Jobs Strata filter. Older Strata Area jobs were saved without an explicit type field, so the filter previously excluded them. The Strata filter now includes every saved job that is not a Quick Close job, and new or resaved Strata jobs are explicitly tagged as type=strata. Existing saved data is preserved.

v8.14 redesigns the Quick Close page into a clearer workflow. Optional job details are tucked into a compact expandable panel; starting coordinates are grouped separately; line entry has dedicated Add Line and Calculate Close actions; save/export/print/new-job options are grouped into secondary tools; the plan preview and closing results are presented together; and full-precision calculation details are collapsed until requested. All original calculator element IDs, save/load, DXF, print and local storage workflows are retained.

v8.13 adds a visible note beside the B&D DXF export button clarifying that DXF files use the original grid coordinates and do not apply the scale factor.

v8.12 adds DXF export to B&D from Coords. It follows the Quick Close R12/AC1009 DXF conventions: a reusable centred survey cross block is inserted at each exact Easting/Northing coordinate with six-decimal precision. It exports mark-name text labels and connecting LINE entities on separate QC_LABEL and QC_LINE layers. Two-point mode exports A–B; three-point mode exports A–B, B–C and C–A. DXF uses original grid coordinates and deliberately does not apply the on-screen scale factor.

v8.11 redesigns the B&D print diagram to prevent labels colliding on narrow or steep triangles. The coordinate geometry is automatically rotated so its longest side is horizontal while preserving true scale. The diagram uses numbered markers on each line and a dedicated side schedule with horizontal, clearly separated values: blue for grid bearing and grid distance, burnt orange for scaled ground distance. Mark names remain on the point markers.

v8.10 improves the B&D calculation print diagram. The diagram is larger and more readable, with line-aligned annotation cards. Blue labels show each line's grid bearing and grid distance together; burnt-orange labels show the scale-factor-adjusted ground distance. Mark labels and point positions remain based on the entered coordinates.

v8.9 adds editable mark names for Points A, B and C in B&D from Coords, and a dedicated Print Calculation report. The printout lists each point's mark name and Easting/Northing, then the line bearings, grid distances, scale-factor-adjusted distances and coordinate differences, plus a coordinate-proportioned line diagram. The report is generated from the current inputs. Swapping A and B also swaps their mark names.

v8.8 adds an optional Point C to B&D from Coords. With Point C enabled, the calculator reports all three survey-mark lines: A→B, B→C and C→A. The scale-factor control multiplies each calculated grid distance and displays both the original grid distance and adjusted distance. The existing two-point A→B calculation remains the default.

v8.7 fixes Quick Close line entry by restoring its line counter, which was accidentally removed during the v8.5 calculator cleanup. The permanent desktop Point Manager sidebar shortcut introduced in v8.6 has been removed; Point Manager remains available from the existing dashboard tool and iPhone More menu.

v8.6 introduced the visual redesign across desktop and iPhone, including the evergreen field-workstation theme, refreshed navigation, dashboard, calculator panels, forms, result cards, tables, job lists, point manager, strata workspace and overlays.

The standalone Traverse and Area calculators remain removed. Quick Close, B&D calculators, Strata Areas, Point Manager, Saved Jobs, Scale, Conversions, and existing local data are retained.

The automatic updater remains enabled. The app checks for a new service worker on open, when returning to the foreground, and when connectivity returns. Updated builds activate automatically and reload once. Network-first page loading keeps GitHub Pages releases fresh; the last cached app shell remains available offline. User jobs and points remain in localStorage and are not cleared by app updates.

Deploy every file from this folder to the repository root on the main branch, including sw.js and v8-workspace.js. Keep manifest.json and icons. The update check requires HTTPS (GitHub Pages is supported).
