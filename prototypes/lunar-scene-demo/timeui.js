// Multi-scale time control. One shared "current time", several slider scales with different step sizes:
// small steps for the Moon's rotation (the Sun swings 0.5 deg/hour), large steps for the orbits (phase, libration, the seasons).
// Switching scale re-centres the slider on the current time, so you zoom from coarse to fine without losing your place.
//
// createTimeUI({ t0, getSky, horizon, onTime, label, elRange })
//   getSky(ms) -> { sun: {az, el}, earth: {az, el, illum} } as seen from the viewpoint (degrees)
//   horizon    Float32Array(360): terrain horizon elevation (deg) per whole degree of azimuth at the viewpoint
//   onTime(ms) called whenever the time changes
//   elRange    half-height of the timeline plot in degrees of elevation (9 near a pole, 90 at the equator)
// returns { get(), set(ms), refresh() }

const H = 3600e3, D = 24 * H;
export const SCALES = [
  { id: 'rot', name: 'Rotation', sub: '10 min', step: 10 * 60e3, half: 144, hint: 'Moon turns once in 27.3 d: the Sun moves ~0.5 deg per hour' },
  { id: 'phase', name: 'Phase & libration', sub: '2 h', step: 2 * H, half: 360, hint: 'one lunar day = 29.5 d; Earth wobbles +-7 deg (libration) every ~27 d' },
  { id: 'orbit', name: 'Orbit', sub: '1 day', step: D, half: 200, hint: 'a year: the sub-solar latitude swings +-1.5 deg every 346.6 d (lunar seasons; at a pole that is the whole up and down of the Sun)' },
  { id: 'cycles', name: 'Long cycles', sub: '15 days', step: 15 * D, half: 240, hint: '+-10 years: how the seasons drift against the calendar' },
];

const fmt = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const sgn = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);

export function createTimeUI({ t0, getSky, horizon, onTime, label = '', elRange = 9 }) {
  // tTarget is where the slider points; tNow glides towards it, so even a coarse scale (1 day per pixel) moves smoothly
  let scale = 1, anchor = t0, tNow = t0, tTarget = t0, playing = false, tl = null, lastSent = NaN;
  const root = document.createElement('div');
  root.id = 'timeui';
  root.innerHTML = `
<style>
#timeui{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(900px,calc(100vw - 24px));box-sizing:border-box;z-index:6;padding:8px 12px 10px;border-radius:8px;
  background:rgba(5,8,14,.72);color:#cfd8e6;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;user-select:none;-webkit-user-select:none}
#timeui .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#timeui button{font:inherit;color:#cfd8e6;background:#141b2b;border:1px solid #2a364f;border-radius:5px;padding:3px 9px;cursor:pointer}
#timeui button:hover{border-color:#5b8cff}
#timeui button.on{background:#27407a;border-color:#5b8cff;color:#fff}
#timeui input[type=text]{font:inherit;color:#cfd8e6;background:#0b101a;border:1px solid #2a364f;border-radius:5px;padding:3px 6px;width:150px}
#timeui input[type=range]{width:100%;margin:4px 0 0;accent-color:#5b8cff}
#timeui canvas{display:block;width:100%;height:58px;margin-top:6px;border-radius:4px;background:#070b13}
#timeui .big{font-size:14px;color:#fff;min-width:170px}
#timeui .dim{color:#7f8da6}
#timeui .sun{color:#ffd45e}#timeui .earth{color:#7db4ff}
</style>
<div class="row"><span class="big" id="tu-time"></span>
  <button id="tu-prev" title="one step back">&#9664;</button><button id="tu-next" title="one step forward">&#9654;</button><button id="tu-play" title="play / pause">&#9205; play</button>
  <span class="dim">jump</span><input type="text" id="tu-jump" placeholder="2026-11-14 12:00" title="UTC, then Enter"><button id="tu-ev" title="Space Apps weekend starts">Nov 14 2026</button>
  <span style="flex:1"></span><span class="dim" id="tu-site"></span></div>
<div class="row" style="margin-top:6px" id="tu-scales"></div>
<canvas id="tu-cv"></canvas>
<input type="range" id="tu-slider" step="0.01">
<div id="tu-read" style="margin-top:4px;white-space:pre"></div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector('#' + id);
  $('tu-site').textContent = label;
  ['pointerdown', 'wheel', 'keydown'].forEach((ev) => root.addEventListener(ev, (e) => e.stopPropagation()));

  const sc = () => SCALES[scale], time = () => tNow;
  const visible = (b) => b.el > horizon[Math.floor(b.az) % 360];

  function buildTimeline() {
    const s = sc(), n = 900, t1 = anchor - s.half * s.step, t2 = anchor + s.half * s.step;
    tl = { t1, t2, sunEl: new Float32Array(n), earthEl: new Float32Array(n), sunVis: new Uint8Array(n), earthVis: new Uint8Array(n) };
    for (let i = 0; i < n; i++) {
      const b = getSky(t1 + (t2 - t1) * i / (n - 1));
      tl.sunEl[i] = b.sun.el; tl.earthEl[i] = b.earth.el; tl.sunVis[i] = visible(b.sun) ? 1 : 0; tl.earthVis[i] = visible(b.earth) ? 1 : 0;
    }
  }

  function drawTimeline() {
    const cv = $('tu-cv'), dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
    if (!w) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = tl.sunEl.length, X = (i) => i / (n - 1) * w, top = 12, Yel = (e) => top + (h - top) * (0.5 - Math.max(-elRange, Math.min(elRange, e)) / (2 * elRange));
    g.fillStyle = '#070b13'; g.fillRect(0, 0, w, h);
    // visibility bands: sun (top strip) and Earth (second strip)
    for (const [arr, y, col] of [[tl.sunVis, 0, '#ffd45e'], [tl.earthVis, 6, '#5b9bff']]) {
      g.fillStyle = col;
      for (let i = 0, s = -1; i <= n; i++) {
        const on = i < n && arr[i];
        if (on && s < 0) s = i; else if (!on && s >= 0) { g.fillRect(X(s), y, Math.max(1, X(i - 1) - X(s)), 4); s = -1; }
      }
    }
    g.strokeStyle = '#26324a'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, Yel(0)); g.lineTo(w, Yel(0)); g.stroke();
    for (const [arr, col] of [[tl.earthEl, '#7db4ff'], [tl.sunEl, '#ffd45e']]) {
      g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath();
      for (let i = 0; i < n; i++) { const y = Yel(arr[i]); if (i) g.lineTo(X(i), y); else g.moveTo(X(i), y); }
      g.stroke();
    }
    g.fillStyle = '#7f8da6'; g.font = '10px ui-monospace,Consolas,monospace';
    g.textAlign = 'left'; g.fillText(fmt(tl.t1).slice(0, 16), 3, h - 3);
    g.textAlign = 'right'; g.fillText(fmt(tl.t2).slice(0, 16), w - 3, h - 3);
    g.textAlign = 'center'; g.fillText(`elevation +-${elRange} deg, 0 = flat horizon`, w / 2, h - 3);
    const cx = (time() - tl.t1) / (tl.t2 - tl.t1) * w;
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, h); g.stroke();
  }

  function readout() {
    const t = time(), b = getSky(t);
    const sv = visible(b.sun), ev = visible(b.earth);
    $('tu-time').textContent = fmt(t);
    $('tu-read').innerHTML =
      `<span class="sun">Sun</span>   az ${b.sun.az.toFixed(1)}&deg;  el ${sgn(b.sun.el, 2)}&deg;  ${sv ? 'above the terrain horizon' : '<span class="dim">hidden by terrain / below horizon</span>'}\n` +
      `<span class="earth">Earth</span> az ${b.earth.az.toFixed(1)}&deg;  el ${sgn(b.earth.el, 2)}&deg;  ${ev ? 'in view (direct-to-Earth line of sight)' : '<span class="dim">hidden by terrain / below horizon</span>'}   phase ${(b.earth.illum * 100).toFixed(0)}% lit`;
    drawTimeline();
  }

  const slider = $('tu-slider');
  const syncSlider = () => { slider.value = (tTarget - anchor) / sc().step; };       // the thumb shows the target, not the gliding time
  // keep the slider window around the target: when it runs off the end, re-centre on it (the time itself does not change)
  const fitWindow = () => { const s = sc(); if (Math.abs(tTarget - anchor) > s.half * s.step) { anchor = tTarget; buildTimeline(); } syncSlider(); };

  function applyScale(i) {
    anchor = tNow; tTarget = tNow; scale = i;            // the time is kept; only the slider's step and range change
    const s = sc(); slider.min = -s.half; slider.max = s.half; syncSlider();
    [...$('tu-scales').querySelectorAll('button')].forEach((bt, j) => bt.classList.toggle('on', j === i));
    $('tu-scales').querySelector('.hint').textContent = s.hint;
    buildTimeline(); readout();
  }
  const setTime = (ms) => { tNow = tTarget = anchor = ms; buildTimeline(); syncSlider(); readout(); lastSent = tNow; onTime(tNow); };   // a jump: no glide
  const nudge = (steps) => { tTarget += steps * sc().step; fitWindow(); };

  const sb = $('tu-scales');
  SCALES.forEach((s, i) => { const b = document.createElement('button'); b.innerHTML = `${s.name} <span class="dim">&middot; ${s.sub}</span>`; b.onclick = () => applyScale(i); sb.appendChild(b); });
  const hint = document.createElement('span'); hint.className = 'hint dim'; sb.appendChild(hint);
  slider.addEventListener('input', () => { tTarget = anchor + +slider.value * sc().step; });
  // arrow keys move by whole steps (the native step is only the 1/100 resolution of the drag)
  slider.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d) { e.preventDefault(); nudge(e.shiftKey ? d * 0.1 : d); }
  });
  $('tu-prev').onclick = () => nudge(-1);
  $('tu-next').onclick = () => nudge(1);
  $('tu-ev').onclick = () => setTime(Date.UTC(2026, 10, 14, 0, 0));
  $('tu-jump').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const ms = Date.parse(e.target.value.trim().replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(e.target.value) ? '' : 'Z')); if (Number.isFinite(ms)) setTime(ms); } });

  // one update per frame: playing advances the target continuously, otherwise the time glides to the target (~0.1 s time constant)
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    if (playing) { tTarget += dt * 6 * sc().step; tNow = tTarget; fitWindow(); }
    else if (tNow !== tTarget) {
      const d = tTarget - tNow;
      tNow = Math.abs(d) < sc().step * 0.002 ? tTarget : tNow + d * (1 - Math.exp(-dt / 0.1));
    }
    if (tNow !== lastSent) { lastSent = tNow; readout(); onTime(tNow); }
    requestAnimationFrame(tick);
  };
  $('tu-play').onclick = () => { playing = !playing; $('tu-play').innerHTML = playing ? '&#10074;&#10074; pause' : '&#9205; play'; $('tu-play').classList.toggle('on', playing); if (playing) tTarget = tNow; };
  requestAnimationFrame(tick);
  addEventListener('resize', drawTimeline);

  applyScale(scale);
  lastSent = tNow; onTime(tNow);
  return { get: time, set: setTime, scale: (i) => applyScale(i), refresh: () => { buildTimeline(); readout(); }, target: () => tTarget };
}
