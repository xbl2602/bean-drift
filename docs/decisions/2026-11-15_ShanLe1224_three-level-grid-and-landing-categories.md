# Three-level grid and category-first Landing Sites panel

- Date: 2026-11-15
- Owner: ShanLe1224
- Scope: product page UI only (`src/ui/product/`). No change to core APIs, shared data or imagery.
- Updates: the grid part of `2026-11-15_ShanLe1224_adaptive-grid-and-feature-names.md`.

## Grid: three levels instead of five

The user asked for only 3 grid levels. The grid now has:

- 30° lines, always on;
- 10° lines from 6 CSS pixels per degree;
- 1° lines from 32 CSS pixels per degree.

The 5° and 0.25° levels are removed. Crossfades, line widths, pixel-ratio handling and limb/pole suppression work as before. Both the 2D map and the 3D globe still use the shared `map-grid.ts` model and shader, and the shader uniform `uGridDetail` is now a `vec2`. The finest level (1°) is reached well before the maximum 2D zoom. The grid button's tooltip now says "30° lines, with 10° and 1° lines as you zoom in".

## Landing Sites: choose a category first

The user found the old panel too messy: the filters and the full list sat together in one bar. The panel now works in two steps.

1. **Choose a category.** Three cards, in this order: Human landing sites, Robotic landing sites, All sites. Each card shows a one-line description and a site count.
2. **See that category's list.** Only the chosen category's sites appear, with a Back button and the category name and count in the header.

While no category is chosen, the map shows all markers, and clicking a marker still opens its details.

The chosen category lives in the app state (`null` = not chosen yet). It therefore survives switching modes and entering and leaving first-person view.

On phones, the three categories appear as three small cards side by side.

The new panel text has keys in all four interface languages. The zh/fr/ja translations are AI-assisted, as recorded in CREDITS.
