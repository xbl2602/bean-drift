<div align="center">

![Bean Drift animated title](docs/assets/bean-drift-title-en.svg)

<a href="https://bean-drift.vercel.app/product">
  <img src="docs/assets/bean-drift-mascot.svg" alt="Bean Drift: astronaut, lander, satellite and rover in a three-scene animation with passing meteors" width="740" />
</a>

<p><em>Meet your guide → choose a landing site → explore your surroundings.</em></p>

<a href="https://bean-drift.vercel.app/product">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&amp;weight=600&amp;size=15&amp;duration=2800&amp;pause=900&amp;color=A3E635&amp;background=0B151D00&amp;center=true&amp;vCenter=true&amp;width=760&amp;lines=%3E+Ask+AI%3A+%2218.12%C2%B0N+49.80%C2%B0E+if+I+land+here+what+surrounds+me%3F%22;%3E+Render+300+km+IAU+Crater+Radar+%2B+360%C2%B0+Horizon+Chart+%2B+HUD+Brief;%3E+Click+%231+Dorsum+Oppel+%E2%9E%94+Fly+3D+Globe+%26+2D+Map+Directly+to+Target;%3E+Stand+on+the+Lunar+Surface+in+360%C2%B0+First-Person+View" />
    <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&amp;weight=600&amp;size=15&amp;duration=2800&amp;pause=900&amp;color=3F6212&amp;background=0B151D00&amp;center=true&amp;vCenter=true&amp;width=760&amp;lines=%3E+Ask+AI%3A+%2218.12%C2%B0N+49.80%C2%B0E+if+I+land+here+what+surrounds+me%3F%22;%3E+Render+300+km+IAU+Crater+Radar+%2B+360%C2%B0+Horizon+Chart+%2B+HUD+Brief;%3E+Click+%231+Dorsum+Oppel+%E2%9E%94+Fly+3D+Globe+%26+2D+Map+Directly+to+Target;%3E+Stand+on+the+Lunar+Surface+in+360%C2%B0+First-Person+View" alt="Ask AI about lunar landmarks, inspect visual charts, and explore the Moon" width="760" />
  </picture>
</a>

[![English](https://img.shields.io/badge/Language-English-a3e635?style=for-the-badge)](README.md)
[![中文文档](https://img.shields.io/badge/语言-中文文档-38bdf8?style=for-the-badge)](README.zh-CN.md)
[![Live Demo](https://img.shields.io/badge/Live_Demo-bean--drift.vercel.app-facc15?style=for-the-badge)](https://bean-drift.vercel.app)
[![Launch Navigator](https://img.shields.io/badge/Launch_Workspace-%2Fproduct-c084fc?style=for-the-badge)](https://bean-drift.vercel.app/product)

*NASA Space Apps Challenge (Kuala Lumpur) Submission — Evaluate solar illumination (power), Earth line-of-sight (comms), terrain slope, and surrounding IAU landmarks at any lunar coordinate and UTC time.*

</div>

> [!NOTE]
> **Prior-Work Disclosure (`D-0008`)**: Base repository scaffolding, documentation templates, and early scene prototypes (`prototypes/`) were adapted from our pre-competition practice repository. Full product integration, the visual AI assistant, IAU radar schematics, and 3D/2D camera synchronization were built for the competition. See [docs/DECISION_LOG.md](docs/DECISION_LOG.md).

---

## 🖥️ Live UI & Mission Workflow Showcase

<div align="center">
  <a href="https://bean-drift.vercel.app">
    <img src="docs/assets/live-landing.png" alt="Bean Drift Live Landing Page" width="49%" />
  </a>
  <a href="https://bean-drift.vercel.app/product">
    <img src="docs/assets/live-product.png" alt="Bean Drift Live 3D Product Workspace" width="49%" />
  </a>
  <p><em>Left: Live Low-Lunar-Orbit Landing Scene (<a href="https://bean-drift.vercel.app"><code>/</code></a>) · Right: Interactive 3D/2D Lunar Workspace & AI Assistant (<a href="https://bean-drift.vercel.app/product"><code>/product</code></a>)</em></p>
</div>

| Step 1 · Ask in Natural Language | Step 2 · Inspect Radar & Horizon Cards | Step 3 · Click Landmark to Fly on Moon |
| :---: | :---: | :---: |
| **Prompt**: *"18.12°N 49.80°E if I choose this place as my landing site what will surround me?"* | **Visual Output**: 300 km IAU schematic radar, numbered feature centers (`1 Dorsum Oppel`, `2 Mare Crisium`), and 360° terrain horizon SVG. | **Interactive Jump**: Click `#1 Dorsum Oppel` or `Show on Moon ↗` to rotate the 3D/2D Moon directly to the target coordinate and stand on the surface. |
| `Ctrl/Cmd + Enter` in **AI Tools** | Zero walls of plain text — collapsible `<details>` HUD | Seamless **3D Globe · 2D Map · 1st-Person** sync |

> [!IMPORTANT]
> ### 🏆 30-Second Judge & Reviewer Challenge (Copy & Try in `AI Tools`!)
> Open [**bean-drift.vercel.app/product**](https://bean-drift.vercel.app/product), click **AI Tools**, and paste any of these three mission prompts:
> 1. **300 km Crater Radar & Click-to-Fly**: `"18.12°N 49.80°E if I choose this place as my landing site what will surround me?"` *(Then click `#1 Dorsum Oppel` to watch the 3D Moon fly there!)*
> 2. **Autonomous Multi-Site Tradeoff**: `"Compare 85.5°S, 30.0°E with the usual landing presets at 2030-06-15T00:00:00Z."`
> 3. **14-Day Eclipse & Outage Windows**: `"Show the Sun and Earth visibility timeline at Shackleton Crater from 2030-01-01T00:00:00Z for 14 days."`

> [!TIP]
> **Try it live right now**: Open [**bean-drift.vercel.app/product**](https://bean-drift.vercel.app/product), click **AI Tools** on the left dock, pick a quick question (or type any lunar coordinate/landmark), and click any numbered crater in the schematic radar to fly the Moon camera!

---

## ✨ What Makes Bean Drift Special?

| 🛰️ Three Ways to View the Moon | 🤖 Chat-to-Fly Visual AI Assistant | 🔌 Open Science API & MCP |
| :--- | :--- | :--- |
| **1. 3D Interactive Globe**: Orbit the Moon with real-time Sun/Earth vectors and LRO LOLA overlays.<br>**2. 2D Projection Map**: Precision coordinate scouting and multi-site pinning.<br>**3. First-Person Surface View**: Stand on the lunar surface with a 360° terrain horizon, compass tape, and live Sun/Earth disks. | Stop reading walls of plain text. Ask a question in natural language and get:<br>• **300 km Nearby IAU Radar Map**<br>• **360° Sky & Terrain Horizon SVG**<br>• **14-Day Visibility Timeline Bars**<br>• **Click-to-Fly Bridge**: Click any numbered crater in the AI panel to fly the 3D/2D Moon directly to that coordinate. | Every physics calculation powers our web UI, REST API (`/api/*`), and Model Context Protocol server (`/mcp`) from a single deterministic core. |

---

## 🏗️ 1. High-Level System Architecture

A clean, four-part runtime architecture keeps credentials strictly on the server while sharing one deterministic lunar calculation core across all interfaces:

```mermaid
flowchart LR
  User(("👩‍🚀 User"))
  subgraph Workspace["Interactive Web Workspace (/product)"]
    Views["🌕 Tri-View Moon Canvas\n3D Globe · 2D Map · 1st-Person"]
    AiPanel["✨ AI Tools Panel\nRadar Map · Horizon SVG · HUD Brief"]
  end
  subgraph Server["Next.js Server & API (/api/* & /mcp)"]
    Agent["🧠 Autonomous AI Engine\nDeepSeek Flash + IAU Gazetteer"]
    RestMcp["🔌 Open REST API & MCP"]
  end
  subgraph Core["Deterministic Lunar Core (src/core)"]
    Physics["📐 Ephemeris & Horizon Physics"]
    Data[("🛰️ NASA LRO LOLA 4ppd\n2030 Stats · 9,000+ IAU Names")]
  end
  User -->|"Explore & Scrub Time"| Views
  User -->|"Ask in Natural Language"| AiPanel
  AiPanel ==>|"Click Landmark (onGoTo)"| Views
  AiPanel -->|"POST /api/agent"| Agent
  Agent -->|"Chained Tool Calls"| Physics
  RestMcp --> Physics
  Physics --> Data
```

---

## 🔭 2. Multi-Vision Moon Explorer & Click-to-Fly Bridge

When you ask the AI about a coordinate or click a numbered landmark (like `1 Dorsum Oppel`) inside the **AI Tools** schematic radar, the UI synchronizes directly with the Moon viewport:

```mermaid
flowchart TB
  Click["👆 Click Landmark #1 or Coordinate in AI Panel"]
  Bridge["🎯 Camera Bridge (onSelectLocation ➔ onGoTo)"]
  subgraph Visions["Choose Your Lunar Perspective"]
    V3D["🌐 3D Globe Mode\nRotates camera & zooms to crater span"]
    V2D["🗺️ 2D Map Mode\nPans projection & drops target pin"]
    V1P["👨‍🚀 First-Person Surface Mode\nClick Stand here to view the 360° horizon sky"]
  end
  Click --> Bridge
  Bridge --> V3D
  Bridge --> V2D
  V3D -.->|"Click to stand here"| V1P
  V2D -.->|"Click to stand here"| V1P
```

---

## 🤖 3. How the AI Procedure Works

Unlike standard chatbots that guess coordinates or output long essays, Bean Drift's agent runs a strict **multi-step verification and visual rendering pipeline**:

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant UI as AI Tools Panel (UI)
  participant G as IAU Gazetteer (9k+ Names)
  participant A as Agent Runner (DeepSeek Flash)
  participant T as Lunar Physics Tools (src/core)
  U->>UI: "18.12°N 49.80°E what surrounds me & compare presets?"
  UI->>G: Resolve coordinates & scan 300 km radius
  G-->>A: Inject exact IAU landmarks (Dorsum Oppel, Mare Crisium...)
  A->>T: Round 1: list_presets() + get_point_conditions()
  T-->>A: Return LOLA slope, height, horizon & 2030 visibility
  A->>T: Round 2: compare_points(user_coord + 4 presets)
  T-->>A: Return multi-site comparison telemetry
  A-->>UI: Return structured tool sources + <120-word HUD Takeaway
  UI-->>U: Render SVG Radar Map + Horizon Chart + Collapsible Details
  U->>UI: Clicks "#1 Dorsum Oppel" on Radar Map
  UI-->>U: 3D/2D Moon flies to 18.7°N, 52.1°E
```

---

## 🔌 Live API & MCP Terminal Showcase

<details>
<summary><strong>📡 Click to expand live REST API & MCP request examples</strong></summary>

```bash
# 1. Query terrain, Sun/Earth elevation, and 2030 annual visibility at a lunar coordinate
curl "https://bean-drift.vercel.app/api/point?lat=-89.9&lon=0&time=2030-01-01T12:00:00Z"

# 2. Ask the autonomous lunar AI assistant via POST /api/agent
curl -X POST "https://bean-drift.vercel.app/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"message":"At 18.12N 49.80E what craters surround me?"}'
```

</details>

---

## 📂 Repository Structure

- `app/` & `src/`: Next.js application (**Bean Drift**)
  - `src/core/`: Analytical ephemeris, horizon masking, annual stats, and read-only tools (`get_point_conditions`, `compare_points`, `get_point_timeline`, `compare_dates`, `find_sites`, `list_presets`, `get_solar_energy_estimate`)
  - `src/features/agent-search/`: Autonomous AI assistant, IAU gazetteer matcher, SVG visual cards, and nearby radar map
  - `src/ui/product/`: 3D Globe, 2D Map, First-Person surface renderer, timeline scrubber, and mission panels
- `public/data/v1/` & `public/product/moon/`: Precomputed NASA LRO LOLA terrain, horizon envelopes, 2030 illumination stats, and IAU lunar nomenclature
- `prototypes/`: Early scene & landing page prototypes ([prototypes/README.md](prototypes/README.md))
- `docs/`: Architecture decisions, deployment guides, and team logs ([docs/README.md](docs/README.md))

---

## 🚀 Run Anywhere: Cloud Website · Docker · Windows/macOS · Linux · CI/CD

Bean Drift is a **self-contained lunar navigation product** with all NASA LRO LOLA terrain grids, horizon profiles, 2030 visibility tables, and IAU nomenclature bundled directly in the repository:

| 🌐 Cloud Website | 🐳 Docker Container | 💻 Windows & macOS | 🐧 Linux & WSL2 | ⚙️ GitHub Actions CI |
| :--- | :--- | :--- | :--- | :--- |
| **Zero Install Browser**<br>Live on Vercel with WebGL 3D/2D & DeepSeek Flash AI.<br><br>👉 [**bean-drift.vercel.app**](https://bean-drift.vercel.app)<br>👉 [**Launch `/product`**](https://bean-drift.vercel.app/product) | **One-Command Container**<br>Package the entire 3D/2D app, NASA datasets & `/mcp` server into an isolated image.<br><br>`docker build -t bean-drift .`<br>`docker run -p 3000:3000 bean-drift` | **Local Desktop PC**<br>Run natively on Windows PowerShell or macOS with Node.js 24.x.<br><br>`git clone ...`<br>`npm install && npm run dev` | **Native & Headless Server**<br>Runs on Ubuntu, Debian & WSL2 as a full workspace or standalone REST/MCP node.<br><br>`npm run build && npm start` | **Automated Linux Gates**<br>Every push & PR runs `npm run typecheck` and 101+ tests (`npm test`) on Ubuntu runners. |

<details>
<summary><strong>🐳 Click to expand Docker, Linux & Local Setup Commands</strong></summary>

```bash
# Option A: Run with Docker (passing optional DeepSeek API key for live AI Tools)
docker build -t bean-drift .
docker run --rm -p 3000:3000 --env-file .env.local bean-drift

# Option B: Run natively on Windows PowerShell, macOS, Linux, or WSL2
git clone https://github.com/xbl2602/bean-drift.git
cd bean-drift
npm install
npm run dev       # Starts http://localhost:3000
npm run typecheck
npm test
```

</details>

- **REST & MCP Endpoints**: `/api/health`, `/api/presets`, `/api/point`, `/api/compare`, `/api/timeline`, `/api/compare-dates`, `/api/find-sites`, `/api/energy`, `/api/agent`, `/mcp`

### Onboarding Reading Order
1. [AGENTS.md](AGENTS.md) — Repository rules & directory ownership
2. [docs/TEAM_HANDBOOK.md](docs/TEAM_HANDBOOK.md) — Roles & workflow
3. [docs/FEATURE_SPEC.md](docs/FEATURE_SPEC.md) — Feature specifications
4. [docs/GIT_GUIDE.md](docs/GIT_GUIDE.md) — Git & PR checklist

---

## 📄 Project Document, Historic Missions & Technical Notes

[Open our Project Document on Google Docs](https://docs.google.com/document/d/1oGul3ofiNASOeoQNFWHs3nDmCb4unRww-JEW6Azwnso/edit?usp=drive_link) · [Watch Pitch & Demo Video (YouTube)](https://youtu.be/D_FPYEtqtFA) · [Deployment guide](docs/DEPLOYMENT.md) · [API and MCP reference](docs/SHARED_INTERFACES.md) · [Data pipeline](pipeline/README.md)

### More capabilities & mission presets
- **Historic & Modern Lunar Landing Site Presets**: Browse and compare verified coordinates across human and robotic missions—including **Apollo 11, 12, 14, 15, 16, and 17**, **Chang'e 4** (far-side Von Kármán crater), **Chandrayaan-3**, **Intuitive Machines IM-1 (Odysseus) & IM-2**, **Firefly Blue Ghost**, **JAXA SLIM**, **Surveyor**, and **Luna 9 & 13**—alongside polar candidate viewpoints such as **Shackleton Crater** and South Pole ridges (e.g., Site A `89.71°S, 62.50°E` vs. Site B `89.61°S, 75.80°E`).
- **Solar-energy estimates**: `/api/energy` and `get_solar_energy_estimate` estimate incident solar energy (using 1360.8 W/m² TSI) and battery needs for darkness. Incident energy is not panel electricity output; efficiency, dust and temperature losses are not included.
- **South-pole terrain & JPL Horizons validation**: the bundled polar dataset provides 160 m terrain where supported (with 10 m/pixel LOLA South Pole and 2 m/pixel LROC NAC Apollo 11 terrain in the first-person prototype scenes); the whole-Moon overview is stored on a 0.25° grid derived from the LOLA `LDEM_64` elevation map (64 pixels per degree, about 474 m per pixel). Analytical ephemeris positions are checked in the automated tests against **JPL Horizons** (8 lunar-surface observers × 14 epochs between 2005 and 2090); the largest Sun/Earth direction difference is about **0.013°**.

### Data limitations
- Ephemerides are analytical approximations, not SPICE or mission-grade landing predictions.
- Precomputed whole-Moon annual statistics cover **2030**; changing the query date does not change that dataset’s year.
- Cell-average slope does not establish landing safety. Nearby-landmark maps are schematics, not surface photographs.
- AI comparisons accept up to **6 points per call**. Responses use supplied tools; each question is independent even when chat history remains visible.

### Setup and verification
Use **Node.js 24.x**, matching `package.json`. The map, REST API and MCP can run without an AI key. For AI Tools, the project owner configures `DEEPSEEK_API_KEY` server-side in `.env.local` or Vercel environment variables. Never commit it or prefix it with `NEXT_PUBLIC_`. Missing configuration returns 503 for the agent endpoint.

```bash
npm run typecheck
npm test
npm run build
```

For deployment configuration and Docker instructions, follow the [deployment guide](docs/DEPLOYMENT.md). The Google document and reference PDF may require access from their owner; repository access does not grant document access.

---

## 📚 Scientific Literature, NASA Datasets & APA 7th Reference List

Every scientific model, elevation grid, crater catalog, and spacecraft coordinate used in **Bean Drift** is backed by peer-reviewed planetary science literature and official NASA Planetary Data System (PDS) archives (compiled in our `REFERENCES_APA7_BeanDrift.pdf` on Google Drive and itemized in [docs/CREDITS.md](docs/CREDITS.md)).

<details>
<summary><strong>📖 Click to expand the complete APA 7th Edition Reference List (Peer-Reviewed Literature, NASA PDS Datasets & Agency Sources)</strong></summary>

### 1. Peer-Reviewed Literature
- **Hurley, D. M., et al. (2015).** An analytic function of lunar surface temperature for exospheric modeling. *Icarus*, *255*, 159–163. https://doi.org/10.1016/j.icarus.2014.08.043 — *Empirical surface-temperature model.*
- **Kopp, G., & Lean, J. L. (2011).** A new, lower value of total solar irradiance: Evidence and climate significance. *Geophysical Research Letters*, *38*(1), L01706. https://doi.org/10.1029/2010GL045777 — *Solar constant (1360.8 W/m²).*
- **Mazarico, E., et al. (2011).** Illumination conditions of the lunar polar regions using LOLA topography. *Icarus*, *211*(2), 1066–1081. https://doi.org/10.1016/j.icarus.2010.10.030 — *Cross-check for polar illumination & Earth visibility.*
- **Meeus, J. (1998).** *Astronomical algorithms* (2nd ed.). Willmann-Bell. — *Lunar and solar position algorithms.*
- **Pike, R. J. (1977).** Apparent depth/apparent diameter relation for lunar craters. *Proceedings of the 8th Lunar Science Conference*, 3427–3436. — *Depth–diameter ratios of simple and complex craters.*
- **Robbins, S. J. (2019).** A new global database of lunar impact craters >1–2 km: 1. Crater locations and sizes, comparisons with published databases, and global analysis. *JGR: Planets*, *124*(4), 871–892. https://doi.org/10.1029/2018JE005592 — *Crater catalogue behind 2D/3D crater detail.*
- **Smith, D. E., et al. (2010).** The Lunar Orbiter Laser Altimeter investigation on the Lunar Reconnaissance Orbiter mission. *Space Science Reviews*, *150*(1–4), 209–241. https://doi.org/10.1007/s11214-009-9512-y — *Instrument reference for LOLA elevation data.*
- **Wagner, R. V., et al. (2017).** Coordinates of anthropogenic features on the Moon. *Icarus*, *283*, 92–103. https://doi.org/10.1016/j.icarus.2016.05.011 — *Apollo landing-site coordinates.*

### 2. NASA Data Products & Agency Coordinates
- **Goddard Space Flight Center, LOLA Science Team.** *LOLA GDR (`LDEM_64`, `LDEM_80S_40M`, `LDEM_875S_10M`)* & *`AVGVISIB_65S` polar visibility tables*. https://imbrium.mit.edu/DATA/LOLA_GDR/
- **ASU LROC Science Team.** *`NAC_DTM_APOLLO11` (2 m/pixel)*, *Robotic Spacecraft Coordinates (Surveyor, Luna)*, *Chang'e 4 (Post 1087)*, and *Featured Landing Sites (IM-2, Blue Ghost)*. https://www.lroc.asu.edu/
- **IAU & USGS Astrogeology Science Center.** *Gazetteer of planetary nomenclature: Moon centre points* & *Robbins Moon crater database v1*. https://planetarynames.wr.usgs.gov/GIS_Downloads
- **JPL Solar System Dynamics Group.** *JPL Horizons on-line ephemeris system* (CI ephemeris validation). https://ssd.jpl.nasa.gov/horizons/
- **NASA SVS, Moon Trek, Earth Observatory & SDO.** *CGI Moon Kit (4720)*, *LRO WAC Global Mosaic 303ppd*, *Blue Marble Next Generation*, *AIA 171 Å solar disk*, and *LRO press releases for IM-1 Odysseus & JAXA SLIM*.

</details>

---

## 👥 Team & Credits

| Pilot | GitHub | Mission Role |
| :---: | :--- | :--- |
| <a href="https://github.com/xbl2602"><img src="https://github.com/xbl2602.png?size=120" width="56" style="border-radius:50%" alt="xbl2602" /></a> | [**@xbl2602**](https://github.com/xbl2602) | **Lead Backend Architect & Project Manager** — Core ephemeris, LOLA data pipeline, REST & MCP server |
| <a href="https://github.com/louis068"><img src="https://github.com/louis068.png?size=120" width="56" style="border-radius:50%" alt="louis068" /></a> | [**@louis068**](https://github.com/louis068) | **AI Search, Backend, PR QA & Documentation** — Autonomous AI search, IAU radar & click-to-fly sync, PR QA, and bilingual docs |
| <a href="https://github.com/chanjy0806"><img src="https://github.com/chanjy0806.png?size=120" width="56" style="border-radius:50%" alt="chanjy0806" /></a> | [**@chanjy0806**](https://github.com/chanjy0806) | **Frontend Engineer (Landing)** — Interactive low-lunar-orbit satellite scene & onboarding storytelling |
| <a href="https://github.com/ShanLe1224"><img src="https://github.com/ShanLe1224.png?size=120" width="56" style="border-radius:50%" alt="ShanLe1224" /></a> | [**@ShanLe1224**](https://github.com/ShanLe1224) | **Frontend Engineer (Product)** — 3D Globe, 2D Map, First-Person surface view & mission analysis panels |
| <a href="https://github.com/leeziqi0531-debug"><img src="https://github.com/leeziqi0531-debug.png?size=120" width="56" style="border-radius:50%" alt="leeziqi0531-debug" /></a> | [**@leeziqi0531-debug**](https://github.com/leeziqi0531-debug) | **Pitch, Documentation & Mission Operations** — Demo production, mission storytelling, project documentation and QA verification |

Built with public lunar datasets from **NASA LRO LOLA**, **LROC NAC**, **NASA SVS CGI Moon Kit**, **NASA Moon Trek**, **JPL Horizons**, and the **IAU/USGS Planetary Gazetteer**. Full attribution in [docs/CREDITS.md](docs/CREDITS.md).
