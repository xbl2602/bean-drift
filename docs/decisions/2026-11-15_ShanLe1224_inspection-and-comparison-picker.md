# Separate location inspection and comparison selection

- Date: 2026-11-15
- Owner: ShanLe1224
- Scope: product UI only; no shared API or data changes.

The user's corrected gesture requirement is single-click for location details, double-click for first-person view. The earlier message asking for double-click details was explicitly withdrawn. The existing tap recognizer and first-tap coordinate retention remain in use in both 2D and 3D; measurement gestures keep their own behavior.

An internal inspect route renders a read-only Landing site details panel with coordinates, first-person preview, Sun/Earth/energy conditions and site metrics. It has Stand here and a Want to compare this location with other sites? prompt followed by Choose sites to compare. This hands the unsaved point to the picker without adding a candidate.

Evaluate → Compare Landing Sites always opens the picker, including when candidates already exist. The internal site route is now a compact comparison picker: choose a point, edit its name, Add site, inspect the list, and use each row's accessible dustbin button to remove only that candidate. Existing names may be edited and rows can focus the corresponding map marker. Compare is disabled below two candidates and is the only picker action that opens the results drawer. Unsaved draft points are not added implicitly. Search result comparison actions also hand points to this picker, maintaining explicit addition in one place.

Comparison results preserve the current ranking, resize/scroll behavior, settings and charts. Clear all is at the end of the drawer beside the export action; it empties candidate, draft and selected-marker state and leaves the drawer in its empty state. Per-site removal remains available.

The top Lunar Quest logo/title is a Next Link to /. This returns to the landing page; the left Home button continues to reset the map. The logo remains clickable when the title is hidden on narrow screens.

Latest main 76a8c00 was fast-forwarded first, preserving and cleanly restoring all pending product/thermal changes in a named stash. Browser checks cover the corrected gestures in 2D/3D, details-to-picker handoff without implicit addition, minimum site count, row deletion, explicit results entry, clear-all at the footer, search handoff, mobile layout and actual navigation to the landing page and back.
