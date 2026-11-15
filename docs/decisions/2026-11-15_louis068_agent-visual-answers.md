# AI search visual answers

2026-11-15 — louis068 / Codex. Implemented only in agent-search; no shared API changes.

## Behavior

- Draw horizon diagrams, current body elevations/disk visibility and annual percentage bars from get_point_conditions and compare_points tool results.
- Draw Sun, Earth and simultaneous visibility windows from get_point_timeline, with exact UTC intervals available in an expandable list.
- Turn list_presets results into location buttons that fill, but do not submit, a dated query. Users review the date before spending another model request.
- Add simultaneous visibility, longest darkness and astronaut-food example questions. Collapse examples once a response arrives.
- Render a small safe subset of text formatting (headings, bold, bullet lists). Do not interpret model HTML, image URLs or executable diagram code.
- Ask for a short takeaway, up to three bullets and one limitation. Visuals never come from invented model numbers. No image-generation service or extra model call is introduced.

## Limits and verification

- Unknown/malformed chart data falls back to the existing answer and raw sources. Null is unavailable, never zero. Annual periods are separate from query dates. Timeline windows share one time axis. Compare-dates and find-sites still use text/raw sources in this initial version.
- Diagrams show coarse terrain and body centres, not disk size or landing safety. All raw sources remain inspectable. No new external assets; diagrams are generated from the returned data.
- All 97 repository tests passed, including three new tests using real local point/timeline tools, checking period/value preservation, null handling, invalid fractions, malformed comparisons and invalid time windows.
- Full-project typecheck is blocked by incomplete local Next.js declarations, including CSS module declarations; production build and browser end-to-end verification remain pending.
- Generated an actual React static preview with real local tool data and explicitly labelled fixture text. Browser access to the local server timed out; file URL preview was blocked by browser policy. No screenshot verification was possible. No paid DeepSeek call or deployment was performed.

## Manual review before merge

1. Run npm ci, npm run typecheck, npm test and npm run build in a working environment.
2. In the product AI panel, compare two locations and inspect horizon/percentage labels at a narrow viewport.
3. Request a timeline; open exact window times and compare to source JSON. Check keyboard focus and the 0-window case.
4. List presets; choose one and verify it only fills the question. Check the UTC date before submitting.
5. Ask a non-location question and verify readable text without fabricated charts. Check cancellation, 429 and unavailable data still work.
