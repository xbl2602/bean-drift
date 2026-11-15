# Nearby named-feature schematic

2026-11-15 — louis068 / Codex.

## Problem and change

The existing gazetteer supplied nearby landmark context to the model but did not include it in response sources. A question such as “18.00°N 82.80°E: what surrounds me?” therefore remained text-only even with visual answers installed.

Return the same local gazetteer lookup through the existing generic sources envelope, identified as lunar_gazetteer. Draw an azimuthal-equidistant schematic in the owned agent-search UI: query coordinate at centre, north/east orientation, distance rings, numbered feature centres and selectable labels with coordinates and catalog diameter. The model does not invent map coordinates. No new image provider, paid request, REST route or registered MCP tool.

## Review note for xbl2602

The generic response shape is unchanged; one source identifier is added. To preserve the existing maximum eight sources, reserve one slot when gazetteer context is present: those requests allow seven tool executions rather than eight. Please reflect this in shared interface documentation if approved. No shared files were edited. This branch builds on b88f3c2 (visual-answer UI); if that PR is unmerged, both commits must be reviewed together or the visual-answer branch merged first.

## Limits

- Explicit N/S E/W or latitude/longitude-labelled coordinates only; arbitrary pairs of numbers and place-name-only questions do not trigger this map. At most four unique valid coordinates, at most five returned features each.
- Map points represent catalog centres, not crater rims or literal visible terrain. Distances are spherical Moon surface distances; marker size is constant, not catalog diameter. Near a pole, orientation depends on the query longitude.
- Existing lookup prefers approximate containing-feature matches and searches for centres within 200 km plus its large-feature radius allowance; it is a selection, not an exhaustive or strictly nearest list. The drawing automatically scales to returned centre distances.
- No terrain heights, horizon occlusion, photographs or resource/landing-safety inference. Circular catalog size tests do not establish actual feature containment. Empty catalog matches are explicitly distinguished from an empty lunar surface.
- Unsupported/malformed source data retains text and raw-source inspection. No model-supplied HTML or image URLs are rendered.

## Verification

- All 101 repository tests pass. New tests cover model-without-tool-call response, actual Cannon lookup, labelled coordinate parsing and deduplication, invalid coordinates, four-location cap, cardinal orientation, antimeridian wrapping, pole finiteness, empty data, and the eight-source budget.
- Inspected the actual React component in a narrow browser preview using real local catalog values for 18°N 82.8°E. An interactive fixture then verified the real LunarSearch client → local /api/agent fixture → real runAgent/gazetteer → source validation → schematic rendering. Clicking the shortcut fills without submitting; submitting produces the map; selecting Cannon highlights its point and reveals 19.88°N, 81.36°E and catalog diameter 57.6 km. Model text was explicitly mocked; no paid provider call. CSS was bundled from actual modules; no production files were added for the fixture.
- Full-project typecheck remains blocked by the pre-existing incomplete Next.js installation (including missing CSS module declarations). No production build, paid DeepSeek request or deployment is claimed.
- Standalone strict TypeScript checking of LunarSearch, runAgent and their imports passed with a local CSS-module declaration used only by the review tooling; that declaration was not added to production source.
