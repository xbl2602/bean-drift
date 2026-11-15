# Adaptive coordinate grid and lunar feature names

- Date: 2026-11-15
- Owner: ShanLe1224
- Scope: product renderer and UI; existing core APIs, shared data and imagery unchanged.

The user explicitly confirmed that Find a new site must keep all comparison candidates and return to picking. The results footer now calls the picker action, clears only the temporary/selected point, and leaves the candidate list intact. Its former destructive Clear all action is no longer shown.

The coordinate grid retains 30-degree major intervals with a thinner anti-aliased CSS-pixel footprint. Four minor levels use 10, 5, 1 and 0.25 degrees at increasing CSS-pixels-per-degree thresholds (6, 12, 32, 80). Consecutive levels crossfade over 20% of their threshold; minor lines remain lower contrast than major lines. Intersections use maximum coverage rather than additive brightness. Device-pixel ratio controls anti-aliasing width, and compressed axes at the 3D limb/poles are suppressed. Both map views supply their actual projection/zoom scale to the shared shader. The finest level is reachable at the existing maximum zoom in both views.

Name labels reuse the existing cached public/product/moon/lunar-names.json catalog: 9,087 IAU Gazetteer / USGS center points, already used by Search Location. No names or coordinates were invented and no new data source or media asset was introduced. A small curated list supplies wide-view priorities; this is a UI choice, not an official popularity ranking. Other large features, smaller features and satellite features become eligible only when their projected sizes and map zoom justify them.

Labels use 10–11 CSS-pixel text, subtle dark outlines, a small location dot and a strict screen-dependent count limit (at most 12 in a wide view and at most 32 in a close view; fewer on small screens). Measured text bounds and spacing prevent label collisions. User pin/search/measurement footprints are reserved first. The existing 3D projection rejects points behind the Moon; 2D longitude wrapping remains unchanged. The label layer is below user annotations and ignores pointer input, so map picking/rotation still works. Catalog loading is asynchronous and does not block the map; a small unavailable message appears if loading fails.

Pure tests cover the four reachable grid levels, continuous/normalized crossfades, broad-to-close name eligibility, density and safe-area bounds, collision priority, marker reservations and occluded/offscreen rejection. Browser checks cover wide and close 2D/3D views, small satellite names appearing only at close range, rotation to the far side, exclusion beside a user pin, mobile density, shader errors, and retaining two candidates through Find a new site.

Latest main 7183251 was fast-forwarded at the start; its files did not overlap pending product edits, which were kept intact.
