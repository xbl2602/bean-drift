// Page orchestration: nav, reveals, the real-data horizon figure, the map UI,
// the first-person scroll, and the recorded agent / MCP playback.
import { initMoonScene } from "./moon.js";
import { loadTerrain, loadApolloTerrain, createMapScene, createFpScene, heightAt } from "./terrain.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// ?fast=1 renders the recorded playback instantly (used for screenshots / QA)
const FAST = new URLSearchParams(location.search).has("fast");
const sleep = (ms) => new Promise((r) => setTimeout(r, reduced || FAST ? 0 : ms));

const app = { moon: null, map: null, fp: null, lastPick: null, timeIndex: 324, sky: null };

/* ------------------------------------------------------------- shell --- */

function initNav() {
  const nav = $("#nav");
  const bar = $("#scroll-bar");
  function tick() {
    const y = window.scrollY;
    nav.classList.toggle("is-stuck", y > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = `${max > 0 ? Math.min(100, (y / max) * 100) : 0}%`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function initReveal() {
  const targets = $$(
    ".split-copy, .split-visual, .mapsec-head, .map-shell, .claims, .deploy-head, .deploy-card, .deploy-strip, .iface-head, .iface-grid, .closing-inner"
  );
  targets.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(140, (i % 4) * 60)}ms`;
  });
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      }),
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
  );
  targets.forEach((el) => io.observe(el));
}

function initCursor() {
  const g = $("#cursor-glow");
  if (!g || reduced) return;
  window.addEventListener(
    "pointermove",
    (e) => {
      document.body.classList.add("has-pointer");
      g.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    },
    { passive: true }
  );
}

function initCopy() {
  $$(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy || "";
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      const old = btn.textContent;
      btn.textContent = "已复制";
      setTimeout(() => (btn.textContent = old), 1400);
    });
  });
}

function initDeployGlow() {
  $$(".deploy-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

/* ------------------------------------------------------- horizon fig --- */

const HZ = { min: -12, max: 34, w: 720, h: 400, padTop: 26, padBottom: 18 };

function hzY(elDeg) {
  const inner = HZ.h - HZ.padTop - HZ.padBottom;
  return HZ.padTop + inner * (1 - (elDeg - HZ.min) / (HZ.max - HZ.min));
}

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/** Apparent elevation of the terrain along one azimuth, seen from the station. */
function sectionAlongAzimuth(terrain, hz) {
  const pt = hz.point;
  if (!terrain || !pt) return null;
  const az = ((hz.sunAzDeg ?? 62) * Math.PI) / 180;
  const eye = (pt.heightM ?? 0) + 1.6;
  const out = [];
  for (let d = 40; d <= 15000; d += 40) {
    const x = pt.xM + Math.sin(az) * d;
    const z = pt.zM - Math.cos(az) * d;
    const h = heightAt(terrain, x, z);
    if (h === null) break;
    const drop = (d * d) / (2 * 1737400);
    out.push({ d, ang: (Math.atan2(h - drop - eye, d) * 180) / Math.PI });
  }
  return out.length > 8 ? out : null;
}

function initHorizonFigure(hz, terrain) {
  const svg = $("#hz-svg");
  if (!svg || !hz) return;
  const els = hz.elevationDeg;
  const bins = els.length;
  const ground = $("#hz-ground-path");
  const rays = $("#hz-rays");
  const station = $("#hz-station");
  const dot = $("#hz-station-dot");
  const labels = $("#hz-labels");
  const cap = $("#hz-caption");

  if (cap && hz.point) {
    const lat = Math.abs(hz.point.latDeg);
    cap.textContent = `${lat.toFixed(2)}°S  ${((hz.point.lonDeg + 360) % 360).toFixed(1)}°E  ·  AZ ${(hz.sunAzDeg ?? 62).toFixed(1)}°`;
  }

  const sunEl = hz.sunElDeg ?? 1.5;
  const zeroY = hzY(0);
  const X0 = 96;
  const X1 = HZ.w - 24;
  const D_MAX = 15000;
  const xOf = (d) => X0 + (d / D_MAX) * (X1 - X0);
  const section = sectionAlongAzimuth(terrain, hz);
  rays.innerHTML = "";
  labels.innerHTML = "";

  let blocked = null;
  if (section) {
    let d = `M ${xOf(section[0].d).toFixed(1)} ${hzY(section[0].ang).toFixed(1)} `;
    for (const p of section) d += `L ${xOf(p.d).toFixed(1)} ${hzY(p.ang).toFixed(1)} `;
    d += `L ${X1} ${HZ.h + 40} L ${X0} ${HZ.h + 40} Z`;
    ground.setAttribute("d", d);
    blocked = section.find((p) => p.ang > sunEl) || null;
  } else {
    // fallback: plain ridge silhouette from the precomputed horizon samples
    let d = `M ${X0} ${HZ.h + 40} `;
    for (let i = 0; i <= bins; i++) {
      d += `L ${(X0 + (i / bins) * (X1 - X0)).toFixed(1)} ${hzY(els[i % bins]).toFixed(1)} `;
    }
    d += `L ${X1} ${HZ.h + 40} Z`;
    ground.setAttribute("d", d);
    blocked = els.some((e) => e > sunEl) ? { d: 200, ang: Math.max(...els) } : null;
  }

  // station
  station.setAttribute("x1", X0);
  station.setAttribute("y1", HZ.padTop);
  station.setAttribute("x2", X0);
  station.setAttribute("y2", zeroY);
  dot.setAttribute("cx", X0);
  dot.setAttribute("cy", zeroY);

  // zero line
  rays.appendChild(
    svgEl("line", { x1: X0, y1: zeroY, x2: X1, y2: zeroY, stroke: "rgba(150,178,202,.35)", "stroke-width": 1, "stroke-dasharray": "3 7" })
  );

  const sunY = hzY(sunEl);
  const stopX = blocked ? xOf(blocked.d) : X1;
  rays.appendChild(
    svgEl("line", { x1: X0, y1: sunY, x2: stopX, y2: sunY, stroke: "#ffb361", "stroke-width": 1.6, opacity: 0.95 })
  );
  rays.appendChild(svgEl("circle", { cx: X0 - 26, cy: sunY, r: 16, fill: "url(#hz-sun-glow)" }));
  rays.appendChild(svgEl("circle", { cx: X0 - 26, cy: sunY, r: 5, fill: "#ffd6a0" }));

  if (blocked) {
    const bx = xOf(blocked.d);
    const by = hzY(blocked.ang);
    rays.appendChild(svgEl("circle", { cx: bx, cy: by, r: 5, fill: "none", stroke: "#ff8f78", "stroke-width": 1.3 }));
    rays.appendChild(
      svgEl("path", {
        d: `M ${bx - 6} ${by - 6} L ${bx + 6} ${by + 6} M ${bx + 6} ${by - 6} L ${bx - 6} ${by + 6}`,
        stroke: "#ff8f78",
        "stroke-width": 1.4,
        opacity: 0.9,
      })
    );
    labels.innerHTML +=
      `<text x="${bx + 9}" y="${by - 9}" fill="#ff8f78" font-family="monospace" font-size="10" letter-spacing="1.5">被遮挡 · ${(blocked.d / 1000).toFixed(1)} km</text>`;
    if (section) {
      const peak = section.reduce((a, b) => (b.ang > a.ang ? b : a), section[0]);
      labels.innerHTML += `<text x="${xOf(peak.d)}" y="${hzY(peak.ang) - 12}" text-anchor="middle" fill="#ff8f78" font-family="monospace" font-size="10" letter-spacing="1.5">山脊 ${peak.ang.toFixed(1)}°</text>`;
    }
  }

  labels.innerHTML +=
    `<text x="${X0 + 10}" y="${sunY - 10}" fill="#ffb361" font-family="monospace" font-size="10" letter-spacing="1.5">SUN +${sunEl.toFixed(1)}°</text>` +
    `<text x="${X0 - 26}" y="${zeroY + 22}" text-anchor="middle" fill="rgba(232,238,245,.75)" font-family="monospace" font-size="9" letter-spacing="1.2">站点</text>` +
    `<text x="${X1}" y="${HZ.h - 6}" text-anchor="end" fill="rgba(150,178,202,.5)" font-family="monospace" font-size="9" letter-spacing="1.2">15 km →</text>` +
    `<text x="${X0}" y="${HZ.h - 6}" fill="rgba(150,178,202,.5)" font-family="monospace" font-size="9" letter-spacing="1.2">0</text>`;

  const maxRidge = section ? Math.max(...section.map((p) => p.ang)) : Math.max(...els);
  const status = $("#hz-status");
  if (status) {
    status.innerHTML = `
      <div class="hz-row is-blocked"><span>太阳 +${sunEl.toFixed(2)}°</span><b>被地形遮挡</b><span>山脊 ${maxRidge.toFixed(1)}°</span></div>
      <div class="hz-row is-blocked"><span>地球 −4.00°</span><b>在地平线以下</b><span>最小遮挡 ${Math.min(...els).toFixed(1)}°</span></div>`;
  }
}

/* -------------------------------------------------------------- utils -- */

function fmtUtc(index) {
  const d = new Date(Date.UTC(2026, 10, 1, 0, 0, 0) + index * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`;
}

const signed = (v, digits = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}°`;
const pct = (v) => `${Math.round(v * 100)}%`;

async function loadJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

/* -------------------------------------------------------------- map ---- */

function initMapUi(terrain) {
  const canvas = $("#map-canvas");
  if (!canvas) return;
  const slider = $("#time-slider");
  const dateEl = $("#map-date");
  const cursorEl = $("#map-cursor");
  const cross = $("#map-cross");
  const stage = $("#map-stage");
  const card = $("#map-card");
  const cardGrid = $("#card-grid");
  const cardTitle = $("#card-title");
  const pin = $("#map-pin");
  const cardClose = $("#card-close");
  const hzCanvas = $("#horizon-canvas");

  const sky = terrain.sky;

  const map = createMapScene({
    canvas,
    terrain,
    reduced,
    onSun: ({ az, el, eaz, eel }) => updateReadouts(az, el, eaz, eel),
    onHover: ({ latDeg, lonDeg, h, slope }) => {
      if (!cursorEl) return;
      cursorEl.textContent = `${Math.abs(latDeg).toFixed(2)}°S ${((lonDeg + 360) % 360).toFixed(1)}°E · ${h.toFixed(0)} m · ${slope.toFixed(1)}°`;
    },
    onPick: (pick) => {
      app.lastPick = pick;
      showCard(pick);
    },
  });
  app.map = map;

  function updateReadouts(az, el, eaz, eel) {
    const set = (id, v) => {
      const el2 = $(id);
      if (el2) el2.textContent = v;
    };
    set("#ro-sun-az", `${az.toFixed(1)}°`);
    set("#ro-sun-el", signed(el));
    set("#ro-earth-az", `${eaz.toFixed(1)}°`);
    set("#ro-earth-el", signed(eel));
    if (dateEl) dateEl.textContent = `${fmtUtc(app.timeIndex)} · 逐小时`;
    const clock = $("#hero-clock");
    if (clock) clock.textContent = `SUN ${az.toFixed(1)}° / EL ${signed(el)}`;
    const label = $("#time-label");
    if (label) label.textContent = fmtUtc(app.timeIndex);
    if (app.lastPick && !card.hidden) updateCardDynamic();
  }

  function applyTime(index) {
    app.timeIndex = index;
    map.setTime(index);
    app.moon?.setYear(index / 8759);
  }
  app.setTime = applyTime;

  function setCrosshair(e) {
    if (!cross) return;
    const r = stage.getBoundingClientRect();
    cross.style.setProperty("--cx", `${e.clientX - r.left}px`);
    cross.style.setProperty("--cy", `${e.clientY - r.top}px`);
  }
  stage?.addEventListener("pointermove", setCrosshair);

  // time slider
  if (slider) {
    slider.addEventListener("input", () => applyTime(Number(slider.value)));
    slider.value = String(app.timeIndex);
  }

  // layers
  $$(".layer").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".layer").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      map.setLayer(btn.dataset.layer);
    });
  });

  // card
  function showCard(pick) {
    const sky2 = sky;
    const az = sky2.sunAz[app.timeIndex];
    const el = sky2.sunEl[app.timeIndex];
    const eaz = sky2.earthAz[app.timeIndex];
    const eel = sky2.earthEl[app.timeIndex];
    cardTitle.textContent = `PICK · ${Math.abs(pick.latDeg).toFixed(3)}°S ${((pick.lonDeg + 360) % 360).toFixed(2)}°E`;
    cardGrid.innerHTML = cardRows(pick, el, eel, true)
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
      .join("");
    card.hidden = false;
    drawHorizonChart(hzCanvas, pick.horizon, az, el, eaz, eel);
    const p = map.projectToScreen(pick.x, pick.h, pick.z);
    pin.style.left = `${p.x}px`;
    pin.style.top = `${p.y}px`;
    pin.classList.add("is-on");
  }

  function updateCardDynamic() {
    const pick = app.lastPick;
    if (!pick) return;
    const az = sky.sunAz[app.timeIndex];
    const el = sky.sunEl[app.timeIndex];
    const eaz = sky.earthAz[app.timeIndex];
    const eel = sky.earthEl[app.timeIndex];
    cardGrid.innerHTML = cardRows(pick, el, eel, false)
      .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
      .join("");
    drawHorizonChart(hzCanvas, pick.horizon, az, el, eaz, eel);
  }

  cardClose?.addEventListener("click", () => {
    card.hidden = true;
    pin.classList.remove("is-on");
    app.lastPick = null;
  });

  // initial
  slider.value = String(app.timeIndex);
  applyTime(app.timeIndex);
}

function cardRows(pick, sunEl, earthEl, full) {
  const base = [
    ["高程", `${pick.h.toFixed(0)} m`],
    ["坡度", `${pick.slope.toFixed(1)}°`],
    ["太阳高度", signed(sunEl, 2)],
    ["地球高度", signed(earthEl, 2)],
  ];
  if (!full) return base;
  const s = pick.stats;
  return base.concat([
    ["年日照", pct(s.sunFraction)],
    ["最长断电", `${s.sunOutageH} h`],
    ["年地球可见", pct(s.earthFraction)],
    ["最长断信号", `${s.earthOutageH} h`],
  ]);
}

function drawHorizonChart(canvas, horizon, sunAz, sunEl, earthAz, earthEl) {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 64;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const yOf = (v) => h - ((v + 10) / 42) * h;

  ctx.strokeStyle = "rgba(150,178,202,.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, yOf(0));
  ctx.lineTo(w, yOf(0));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < horizon.length; i++) ctx.lineTo((i / (horizon.length - 1)) * w, yOf(horizon[i]));
  ctx.lineTo(w, h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(47,143,163,.55)");
  g.addColorStop(1, "rgba(47,143,163,.08)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(127,215,234,.65)";
  ctx.stroke();

  const mark = (az, el, color) => {
    const x = (((az % 360) + 360) % 360) / 360 * w;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, yOf(el), 2.4, 0, Math.PI * 2);
    ctx.fill();
  };
  mark(sunAz, sunEl, "#ffb361");
  mark(earthAz, earthEl, "#7fd7ea");
}

/* --------------------------------------------------------- first person */

function initFirstPerson(terrain) {
  if (!terrain) return;
  const canvas = $("#fp-canvas");
  if (!canvas) return;
  const meta = terrain.meta;
  const sun = {
    azDeg: meta.sunAzDeg,
    elDeg: meta.sunElDeg,
    earthAzDeg: meta.earthAzDeg,
    earthElDeg: meta.earthElDeg,
  };
  const el = $("#fp-sun-el");
  if (el) el.textContent = signed(sun.elDeg);
  const az = $("#fp-sun-az");
  if (az) az.textContent = `${sun.azDeg.toFixed(1)}°`;
  const fp = createFpScene({ canvas, terrain, sun, reduced });
  app.fp = fp;

  const section = $("#firstperson");
  function tick() {
    const r = section.getBoundingClientRect();
    const total = Math.max(1, r.height - window.innerHeight);
    fp.setProgress(Math.min(1, Math.max(0, -r.top / total)));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* --------------------------------------------------------------- chat -- */

function initChat(compare) {
  const body = $("#chat-body");
  if (!body || !compare) return;

  const rows = compare.results;
  const name = ["南极 A", "南极 B", "阿波罗 11 号"];
  const table = rows
    .map((r, i) => {
      const sun = r.sun.elevationDeg;
      const earth = r.earth.elevationDeg;
      const cls = (v) => (v >= 0 ? "pos" : "neg");
      return `<tr><td>${name[i] || i}</td><td class="num">${signed(sun, 2)}</td><td class="num ${cls(sun)}">${sun >= 0 ? "可见" : "夜间"}</td><td class="num">${signed(earth, 2)}</td><td class="num ${cls(earth)}">${earth >= 0 ? "可直连" : "被遮挡"}</td></tr>`;
    })
    .join("");

  let played = false;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (en) => {
        if (!en.isIntersecting || played) return;
        played = true;
        io.disconnect();
        await play();
      });
    },
    { threshold: 0.25 }
  );
  io.observe(body);

  async function typeInto(el, text, speed = 16) {
    if (reduced || FAST) {
      el.textContent = text;
      return;
    }
    for (let i = 0; i < text.length; i++) {
      el.textContent = text.slice(0, i + 1);
      await sleep(speed);
    }
  }

  async function play() {
    const user = document.createElement("div");
    user.className = "msg msg-user";
    user.innerHTML = `<div class="msg-who">USER</div><div class="msg-text"></div>`;
    body.appendChild(user);
    await typeInto(user.querySelector(".msg-text"), "对比阿波罗 11 号和南极两处，2026-11-14 12:00 UTC 的光照与对地通信。", 18);
    await sleep(360);

    const agent = document.createElement("div");
    agent.className = "msg";
    agent.innerHTML = `<div class="msg-who">AGENT</div><div class="msg-text"></div>`;
    body.appendChild(agent);
    const slot = agent.querySelector(".msg-text");

    const chip = document.createElement("div");
    chip.className = "msg-tool";
    chip.innerHTML = `<span>tools/call</span><b>compare_points</b><span>3 个点位 · 只读</span>`;
    slot.appendChild(chip);
    await sleep(520);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<table class="msg-table"><thead><tr><th>站点</th><th>太阳高度</th><th>光照</th><th>地球高度</th><th>链路</th></tr></thead><tbody>${table}</tbody></table>`;
    slot.appendChild(wrapper);
    await sleep(520);

    const out = document.createElement("p");
    out.style.margin = "10px 0 0";
    out.style.color = "var(--ink)";
    slot.appendChild(out);
    await typeInto(
      out,
      "三个点没有一个同时成立：南极有阳光，但地球在地平线下；阿波罗 11 号看得见地球，此刻却是月夜。所以这件事只能逐点、逐时算。",
      13
    );
  }
}

/* ----------------------------------------------------------- terminal -- */

function initTerminal(tools, mcpCall) {
  const pre = $("#mcp-term");
  if (!pre) return;
  const replay = $("#term-replay");

  const toolList = tools?.result?.tools || [];
  const zh = { get_point_conditions: "单点参数", compare_points: "多点对比", list_presets: "预设点" };
  const sc = mcpCall?.result?.structuredContent;
  const callBody = sc
    ? JSON.stringify(
        {
          position: sc.position,
          timeUtc: sc.timeUtc,
          sun: sc.sun,
          earth: sc.earth,
          terrain: sc.terrain,
          yearStats: sc.yearStats,
        },
        null,
        2
      )
    : "{}";

  const lines = [
    { cls: "t-prompt", text: ">> POST https://bean-drift.vercel.app/mcp", typed: true, speed: 12 },
    { cls: "t-cmd", text: '{"jsonrpc":"2.0","id":2,"method":"tools/list"}', typed: true, speed: 8 },
    { cls: "t-ok", text: `<< 200 OK · ${toolList.length} 个工具，全部只读`, pause: 220 },
    ...toolList.map((t) => ({ cls: "t-out", text: `   ${t.name.padEnd(20, " ")} ${zh[t.name] || ""}`, pause: 90 })),
    { cls: "t-prompt", text: "", pause: 260 },
    { cls: "t-prompt", text: ">> POST https://bean-drift.vercel.app/mcp", typed: true, speed: 12 },
    {
      cls: "t-cmd",
      text: '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_point_conditions","arguments":{"latDeg":-89.71,"lonDeg":62.5,"time":"2026-11-14T12:00:00Z"}}}',
      typed: true,
      speed: 5,
    },
    { cls: "t-ok", text: "« 200 OK · tools/call · get_point_conditions", pause: 240 },
    ...callBody.split("\n").map((l) => ({ cls: "t-out", text: l, pause: 45 })),
  ];

  let running = false;
  async function play() {
    if (running) return;
    running = true;
    pre.textContent = "";
    for (const line of lines) {
      const div = document.createElement("div");
      div.className = line.cls;
      pre.appendChild(div);
      if (line.typed && !reduced && !FAST) {
        const speed = line.speed ?? 10;
        for (let i = 0; i < line.text.length; i++) {
          div.textContent = line.text.slice(0, i + 1);
          if (i % 2 === 0) await sleep(speed);
        }
      } else {
        div.textContent = line.text;
      }
      pre.scrollTop = pre.scrollHeight;
      await sleep(line.pause ?? 60);
    }
    running = false;
  }

  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && play()),
    { threshold: 0.2 }
  );
  io.observe(pre);
  replay?.addEventListener("click", () => {
    running = false;
    play();
  });
}

function initRestPreview(mcpCall) {
  const el = $("#rest-preview");
  const sc = mcpCall?.result?.structuredContent;
  if (!el || !sc) return;
  const compact = {
    position: sc.position,
    timeUtc: sc.timeUtc,
    sun: sc.sun,
    earth: {
      azimuthDeg: sc.earth.azimuthDeg,
      elevationDeg: sc.earth.elevationDeg,
      aboveSphericalHorizon: sc.earth.aboveSphericalHorizon,
      distanceKm: sc.earth.distanceKm,
    },
    terrain: sc.terrain,
    yearStats: sc.yearStats,
  };
  el.textContent = JSON.stringify(compact, null, 2);
}

/* -------------------------------------------------------------- boot --- */

function safeInitMoon() {
  const canvas = $("#moon-canvas");
  if (!canvas) return null;
  try {
    return initMoonScene({ canvas, labelLayer: $("#node-layer"), reticle: $("#reticle"), reduced });
  } catch (err) {
    console.error("[moon]", err);
    return null;
  }
}

async function boot() {
  initNav();
  initReveal();
  initCursor();
  initCopy();
  initDeployGlow();

  app.moon = safeInitMoon();

  const [horizon, compare, tools, mcpCall] = await Promise.all([
    loadJson("./assets/horizon-basin.json").catch(() => null),
    loadJson("./data/recorded/compare.json").catch(() => null),
    loadJson("./data/recorded/mcp-tools-list.json").catch(() => null),
    loadJson("./data/recorded/mcp-call-point.json").catch(() => null),
  ]);
  initChat(compare);
  initTerminal(tools, mcpCall);
  initRestPreview(mcpCall);

  let terrain = null;
  try {
    terrain = await loadTerrain();
  } catch (err) {
    console.warn("[terrain]", err);
  }
  if (terrain) {
    initHorizonFigure(horizon, terrain);
    initMapUi(terrain);
  } else {
    initHorizonFigure(horizon, null);
  }

  let apollo = null;
  try {
    apollo = await loadApolloTerrain();
  } catch (err) {
    console.warn("[apollo]", err);
  }
  if (apollo) initFirstPerson(apollo);
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => console.error("[boot]", err));
});

