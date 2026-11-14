# Project README replacement proposal

Date: 2026-11-14. Author: louis068 (Bean), with Codex assistance.

For xbl2602 to review and apply to the root README.md. This proposal updates the outdated placeholder-page description without modifying shared documentation directly. Based on local main e3470af; fetching the current remote failed, so deployment and integration status must be checked before publishing. Links inside the block are relative to the repository root, their intended destination.

Review points: confirm the current AI panel integration; confirm CI and Docker status; retain the existing disclosure of pre-existing work and the asset-specific credits. No new data, artwork, or licensing claim is introduced.

Copy the following block into the root README.md after review:

````markdown
# Bean Drift — Lunar Landing Site Navigator

Explore the Moon, compare candidate locations, and understand when the Sun and Earth are visible above the lunar horizon.

Built for the **NASA Space Apps Challenge in Kuala Lumpur**, Bean Drift is a website for exploring lunar illumination and direct-to-Earth visibility. It combines an interactive lunar map, terrain views, time controls, comparison tools, and a natural-language query service.

**[Open the website](https://bean-drift.vercel.app/)** · **[Open the explorer](https://bean-drift.vercel.app/product)** · **[API documentation](docs/SHARED_INTERFACES.md)**

> Educational exploration and coarse site screening only. The project uses NASA-derived terrain and imagery together with approximate astronomical calculations. It does not use mission-grade SPICE ephemerides, certify landing safety, or calculate a complete power or communications link budget.

## Why this matters

Near the lunar poles, the Sun stays close to the horizon. Nearby terrain can block sunlight and Earth visibility, making location and time important when comparing possible exploration sites. Bean Drift brings these conditions together so users can ask practical questions about light, terrain, and communication opportunities.

## Explore the website

1. Open the website and enter the explorer at `/product`.
2. Switch between the 2D lunar map and 3D globe.
3. Search for a location or select a point on the Moon.
4. Change the date and time using the timeline; inspect Sun and Earth conditions.
5. Save locations and compare their conditions, or open the surface view to inspect the local horizon.

Available product components include map layers, coordinate search, saved sites, location comparison, and a first-person surface view. These visualizations help explain the data; decorative surface detail and reference imagery are not additional scientific measurements.

### AI search status

The repository provides a reusable `LunarSearch` component and the server endpoint `POST /api/agent`. The product page's AI panel in the source reviewed for this README is still a “Not connected yet” placeholder. The backend and reusable component exist, but their availability does not mean the product page is already wired to them. Confirm the latest integration before claiming end-to-end AI search on the live website.

Integration instructions: [agent-search README](src/features/agent-search/README.md).

## What the query tools can do

The backend exposes the same read-only capabilities through REST and MCP, and makes six tools available to the AI assistant:

| Capability | Tool | Purpose |
|---|---|---|
| Point conditions | `get_point_conditions` | Terrain, Sun/Earth conditions, visibility, and available annual statistics for a location |
| Compare locations | `compare_points` | Compare locations at the same time |
| Preset locations | `list_presets` | List known locations without inventing coordinates |
| Time curves | `get_point_timeline` | Sun/Earth curves and visibility windows for up to 31 days |
| Compare dates | `compare_dates` | Compare up to 5 locations at up to 8 times |
| Find locations | `find_sites` | Screen the lunar grid using slope, visibility fractions, outage durations, and geographic bounds |

Point comparisons allow up to **10 locations through REST/MCP** and **6 per AI tool call**, because AI tool results have a size limit. Earth minimum elevation is an optional input on supported point/time queries; no mission-specific threshold is assumed by default. The coarse site-search map does not apply that threshold.

Example AI questions, once the service is configured and the search component is connected:

- “List the lunar presets.”
- “At latitude -89.9°, longitude 0°, show Sun and Earth visibility at 2030-03-05T00:00:00Z.”
- “Show 14 days of visibility at latitude -89.9°, longitude 0°, starting 2030-03-05T00:00:00Z.”
- “Find cells south of 80°S with a mean slope below 10°. Explain the data limitations.”

Each request is independent: include coordinates and dates in the question rather than relying on a previous conversation. AI answers may be wrong; inspect the returned tool sources and provenance.

## Data and scientific limitations

| Part | Basis | Interpretation |
|---|---|---|
| Global terrain | NASA LRO LOLA LDEM64, processed offline | A coarse overview, not a landing hazard map |
| Map and sky imagery | NASA assets documented in the credits | Reference imagery, not live camera or weather feeds |
| Sun/Earth positions | Analytical ephemeris and lunar orientation calculations | Approximate calculations; SPICE is not integrated |
| Terrain visibility | Precomputed terrain horizons and runtime calculations | Limited by terrain grid spacing and horizon sampling |
| Annual statistics | Hourly samples for 2030 | Separate from the user's selected date; not an 18.6-year worst-case analysis |

- The global output grid is **0.25°**, about 7.6 km in north–south spacing. Terrain slopes represent averages, not every small crater, boulder, or ridge.
- Horizon data uses 32 azimuth directions from each grid-cell centre; narrow terrain features can be missed.
- “Sun visible” does not guarantee usable electrical power, and “Earth visible” does not guarantee a working radio link.
- Missing fields are reported as unavailable or `null`; they must not be interpreted as zero or flat terrain.
- A missing rise/set event within a search window does not establish permanent invisibility.
- Inspect each response's `provenance` and the [data manifest](public/data/v1/manifest.json). Details: [pipeline documentation](pipeline/README.md).

## Run locally

Requirements: **Node.js 24.x**, npm, and Git. No database setup is required for the current implementation.

```sh
git clone https://github.com/xbl2602/bean-drift.git
cd bean-drift
npm ci
npm run dev
```

Open `http://localhost:3000` for the landing page or `http://localhost:3000/product` for the explorer. If repository access is restricted, ask the repository owner for access.

Precomputed files under `public/data/v1/` ship with the repository. Normal local use and deployment do not require downloading the raw DEM or running the data pipeline.

### Enable AI queries

The map and non-AI APIs do not require a model key. The AI endpoint requires the project owner's `DEEPSEEK_API_KEY` on the server.

For local use, the authorized key holder can create a git-ignored `.env.local` and configure that variable privately, following [.env.example](.env.example). Never put the real value in source code, screenshots, a PR, or a browser-facing `NEXT_PUBLIC_` variable.

The server calls DeepSeek using the model ID `deepseek-flash`; the browser calls only this website's `/api/agent` endpoint. Without a key, AI requests return **503** rather than simulated answers. Real AI requests consume the configured DeepSeek account's usage.

Requests are bounded to 2,000 input characters, 4 model calls, 8 tool calls, and a 25-second handler timeout. The documented production Vercel firewall applies 20 requests per minute per IP; that rule is external configuration and is not automatically provided by a local or Docker deployment. See [deployment instructions](docs/DEPLOYMENT.md).

## Test and build

```sh
npm test
npm run typecheck
npm run build
npm start
```

Automated tests use model substitutes and real local data tools; they do not need a DeepSeek key or make paid model calls. A passing test suite does not by itself verify the live website or provider integration.

Quick checks:

- `/api/health` should return `{"status":"ok","service":"bean-drift"}`.
- `/api/point?latDeg=-89.9&lonDeg=0` should return point data. Check `provenance.terrain.status`; `unavailable` can indicate missing packaged data.
- Test the AI endpoint only after server configuration; inspect its returned `sources`, not just the generated answer.

## Deploy

### Vercel

1. Import the GitHub repository into Vercel as a Next.js project using Node.js 24.x.
2. Use the repository's build configuration and include the committed precomputed data.
3. Have the key holder add `DEEPSEEK_API_KEY` in the project's environment settings for the intended environments. Redeploy after changing it.
4. Recreate the documented AI firewall rule if setting up a new Vercel project.
5. Verify `/`, `/product`, `/api/health`, and the data endpoints. Confirm the public competition URL is accessible to visitors without a Vercel account.

The documented team setup deploys `main` to production and other branches to previews. Confirm successful checks and deployment before sharing an updated URL. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for operational details.

### Docker

```sh
docker compose up --build
```

Open `http://localhost:3000`. Compose optionally reads `.env.local` for server configuration. Docker support is included, but the team's deployment documentation currently marks the Docker build as **not yet verified**.

## API and MCP

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Service health |
| `/api/presets` | GET | Known locations |
| `/api/point` | GET | One location and time |
| `/api/compare` | POST | Compare locations |
| `/api/timeline` | GET | Time curves and visibility windows |
| `/api/compare-dates` | POST | Compare locations across dates |
| `/api/find-sites` | POST | Search the coarse lunar grid |
| `/api/agent` | POST | Natural-language query, body: `{"message":"List the lunar presets"}` |
| `/mcp` | HTTP | MCP tool access |

Full parameter schemas, units, limits, and response fields: [SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md).

## Architecture

Built with **Next.js, React, TypeScript, Tailwind CSS, three.js, and Zod**, with a server-side DeepSeek adapter.

```text
app/                     Pages, REST routes, and MCP entry point
src/core/                Shared data models, ephemeris, data access, tool registry
src/features/            Feature logic and API/MCP adapters; AI search component
src/ui/landing/          Landing page
src/ui/product/          Explorer, map/globe, surface view, and panels
pipeline/                Offline terrain and visibility preprocessing
public/data/v1/          Versioned precomputed data and provenance manifest
prototypes/              Earlier experiments and reference implementations
docs/                    Interfaces, deployment, decisions, credits, and team logs
```

NASA terrain is processed offline into versioned files. The shared data layer reads those files and supplies the same feature logic to REST, MCP, and the read-only AI tools. The model explains tool results; it is not the scientific data source.

## Team and contributing

| GitHub | Responsibility |
|---|---|
| `xbl2602` | Backend architecture, shared interfaces, deployment, project coordination |
| `louis068` (Bean) | Backend features and AI search |
| `chanjy0806` | Landing page |
| `ShanLe1224` | Product page and rendering |
| `leeziqi0531-debug` | Pitch/video and supporting work |

Read [AGENTS.md](AGENTS.md), [TEAM_HANDBOOK.md](docs/TEAM_HANDBOOK.md), and [GIT_GUIDE.md](docs/GIT_GUIDE.md) before editing. Work in assigned directories, use a feature branch, and submit a PR for review. Shared interface changes require coordination with the project lead.

## Credits and project history

Data, imagery, source-specific permissions, unresolved licensing notes, and AI assistance are recorded in [CREDITS.md](docs/CREDITS.md). Do not assume every asset has the same license.

The framework, documentation structure, and prototypes include work carried over from an earlier practice repository; they were not all created during the competition. See decision D-0008 in [DECISION_LOG.md](docs/DECISION_LOG.md). Code and documentation were developed with AI assistance; scientific results come from the documented data and calculation methods.

For further documentation, start at [docs/README.md](docs/README.md).
````
