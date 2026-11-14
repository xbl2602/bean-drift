# Close-up lunar imagery loaded on demand

- Date: 2026-11-14
- Author: ShanLe1224 / Codex
- Context: User explicitly requested clear lunar imagery at close zoom; one 16K global image still becomes blurry when magnified.
- Implementation: Keep the local global colour map and existing rendering/analysis. At close zoom, display NASA Moon Trek LROC WAC imagery tiles in both 2D and 3D, limited to the visible region. Four concurrent requests, a 128-bitmap cache, stale-request cancellation, maximum level 8, and a bounded atlas prevent unbounded downloads/GPU allocations. Do not replace the 16K base with a coarser tile level near the poles.
- Source: https://trek.nasa.gov/tiles/apidoc/ documents public WMTS services; verified layer capabilities and actual imagery from LRO_WAC_Mosaic_Global_303ppd_v02. Credits and source links are in CREDITS.md. The earlier frontend research identified this service; availability remains an external dependency, so local imagery stays visible on failures.
- Scientific boundary: These are display photographs with acquisition-time shading. They do not improve the DEM, simulated shadows, slope accuracy, or numerical conditions. No shared API/data interfaces changed.
- Validation: Browser close-up renders and tile updates in 2D/3D, view switching, no shader errors. A focused mocked-network regression check covers date-line wrapping, valid tile addresses, four-request concurrency, repeat-view caching, offline fallback notice, and bitmap disposal. TypeScript and diff checks pass.
- Remaining limitation: This is global WAC imagery, not metre-scale NAC imagery; detail is finite. First-person terrain is unchanged. A completely offline detailed map would require separate hosting/storage work.
