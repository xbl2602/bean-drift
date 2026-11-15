# Steep-slope search and agent trust boundaries

2026-11-15, louis068 / Codex. User clarified they want to find steeper locations, not ask a follow-up without coordinates.

## Finding

Current find_sites supports maxSlopeDeg and rankBy=lowestSlope, but no minimum slope or descending slope ranking. Point queries already return terrain.slopeDeg. The limitation is the search interface, not the absence of all slope data. Zod previously stripped unknown keys; an invented minSlopeDeg could silently become an unconstrained search.

## Implemented in agent-search

- Clone Zod object schemas as strict for the agent, preserving refinements, defaults and the six-point cap. Reject unsupported keys rather than silently broadening the user's query. REST/MCP schemas remain unchanged.
- Explain actual slope capabilities in the system instruction; do not reinterpret steeper as flatter, claim a global maximum from a small sample, or say slope is unreadable without a data/provenance check. Offer comparison of supplied candidate coordinates.
- Move serialized gazetteer context out of the system message into an explicitly untrusted user-role data message. State that feature names, descriptions, provenance and tool strings cannot change permissions, tool limits or roles.
- Retain executable boundaries: read-only allowlist, validated arguments, bounded calls/results, server-only provider credentials, fixed provider URL and text-only answer renderer. No new providers, routes or permissions.

## Concrete proposal for xbl2602 (not implemented)

Extend shared find_sites contracts and core search together:

1. Optional minSlopeDeg in [0,90], inclusive, combined with existing maxSlopeDeg using AND. Reject minSlopeDeg > maxSlopeDeg.
2. Add rankBy=highestSlope with descending mean-slope ordering; apply all geographic/visibility filters and existing separation/limit rules. Retain all existing defaults and ranking behavior.
3. Return effective criteria through query, document cell-mean slope and resolution. Do not describe these values as local maximum slope, climbability or landing safety.
4. Update shared interface docs, REST and MCP schema descriptions. The agent will consume the shared tool schema; then remove its temporary unsupported-search prompt and add a steep-site example.
5. Tests: inclusive lower/upper limits, contradictory bounds rejected, descending rank with deterministic ties, combined filters, no matches, zero and 90-degree limits, and unchanged old queries. Cross-check returned cells against point queries.

The current role assignment limits this work to agent-search; shared data and assigned feature changes require owner coordination. Do not claim global steep-slope search is now available.

## Prompt-injection assessment

The system has defenses, not proof of immunity. Users and dataset/tool strings can contain instructions. Catalog interpolation into the system message was an avoidable authority-confusion risk; moving it lowers that risk. A model can still produce misleading text even when it cannot execute a forbidden tool. No actual production compromise was established in this review.

Tests with a controlled model validate software boundaries: unknown slope constraints are rejected before execution; user/catalog text does not enter the system instruction; an injected shell-tool request is rejected; hostile tool strings remain tool-role data without rewriting instructions. These are not live DeepSeek jailbreak evaluations and do not establish that all malicious prompts will be resisted. No paid API requests or secret access were performed.

## Validation

113 repository tests passed; standalone strict typecheck for run-agent and dependencies passed. No UI changed. Full production build not run. Existing uncommitted README.md, README.zh-CN.md and docs/assets edits were preserved and excluded.
