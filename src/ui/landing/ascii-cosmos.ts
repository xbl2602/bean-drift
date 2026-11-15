// The closing scene's engine: a small physics toy drawn as ASCII art.
//
// Everything (stars, the black hole's disk, the shock wave, the Sun and planets) is a point of
// light with a position and a colour. Each frame the points are "splatted" into a grid of
// character cells; a cell's brightness picks its character from a ramp and its colour is the
// average of what landed in it. That is what gives it the ASCII-motion look.
// Every look-and-feel number lives in cosmos-params.ts (and can be tuned live in the developer panel).
//
// Story: idle starfield -> hold = a black hole forms at the pointer and swallows the stars (and any
// solar system) -> release = it explodes and a solar system condenses out of the debris.

import { GlyphAtlas } from "./ascii-glyphs";
import { type CosmosParams, DEFAULT_PARAMS, RAMPS } from "./cosmos-params";
import { drawSolarSystem, drawSystemLabels, PLANETS, type RGB } from "./cosmos-system";

export type CosmosPhase = "idle" | "holding" | "exploding" | "system";

const STAR_MAX = 2600;
const MILKY_MAX = 1500;
const SPARK_MAX = 420;
const DISK_BASE = 620;
const DISK_MAX = 1600;
const BELT_MAX = 380;
const EXPLODE_S = 1.6;

type Dust = { x: number; y: number; vx: number; vy: number; hx: number; hy: number; mode: 0 | 1 | 2; fade: number; hue: number; size: number; rank: number; band: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Disk = { angle: number; radius: number; hue: number };
export type Rock = { angle: number; radius: number; speed: number; hue: number };

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seeded = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

export class AsciiCosmos {
  phase: CosmosPhase = "idle";
  params: CosmosParams = { ...DEFAULT_PARAMS };
  width = 1;
  height = 1;
  dpr = 1;
  cellW = 6;
  cellH = 8;
  cols = 1;
  rows = 1;
  fontPx = 10;
  pointer = { x: 0, y: 0, isOver: false };
  /** Where the black hole is, or where the system formed. */
  anchor = { x: 0, y: 0 };
  systemCenter = { x: 0, y: 0 };
  hoverName = "";
  hasSystem = false;
  holdS = 0;
  sinceReleaseS = 0;
  timeS = 0;
  systemAngle = PLANETS.map((_, i) => i * 2.3 + 0.7);
  systemScale = 1;
  belt: Rock[] = [];
  /** Vertical band (px from the top of the section) that is free of headline and button. */
  private zoneTop = 0;
  private zoneBottom = 0;
  private atlas: GlyphAtlas | null = null;
  private rampIndex = 1;
  private energy = new Float32Array(1);
  private red = new Float32Array(1);
  private green = new Float32Array(1);
  private blue = new Float32Array(1);
  private touched: number[] = [];
  private dust: Dust[] = [];
  private sparks: Spark[] = [];
  private disk: Disk[] = [];

  constructor() {
    const rnd = seeded(11);
    for (let i = 0; i < STAR_MAX + MILKY_MAX; i++) {
      const band = i >= STAR_MAX;
      let hx = rnd();
      let hy = rnd();
      if (band) {
        // The Milky Way: a soft diagonal band of many faint points.
        const along = rnd();
        const across = (rnd() + rnd() + rnd() - 1.5) * 0.16;
        hx = 0.02 + along * 0.96 - across * 0.35;
        hy = 0.9 - along * 0.7 + across;
      }
      this.dust.push({ x: 0, y: 0, vx: 0, vy: 0, hx, hy, mode: 0, fade: rnd(), hue: rnd(), size: band ? 0.4 + rnd() * 0.5 : 0.5 + rnd() * rnd() * 1.4, rank: rnd(), band });
    }
    for (let i = 0; i < SPARK_MAX; i++) this.sparks.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, hue: rnd() });
    for (let i = 0; i < DISK_MAX; i++) this.disk.push({ angle: rnd() * Math.PI * 2, radius: 1.35 + Math.pow(rnd(), 1.5) * 3.1, hue: rnd() });
    for (let i = 0; i < BELT_MAX; i++) this.belt.push({ angle: rnd() * Math.PI * 2, radius: 0.345 + rnd() * 0.05, speed: 0.4 + rnd() * 0.2, hue: rnd() });
  }

  resize(widthPx: number, heightPx: number) {
    this.width = Math.max(widthPx, 1);
    this.height = Math.max(heightPx, 1);
    const { cellScale, lineHeight } = this.params;
    this.fontPx = Math.min(24, Math.max(5, Math.min(15, Math.max(10, this.width / 105)) * cellScale));
    this.cellW = this.fontPx * 0.6;
    this.cellH = this.fontPx * lineHeight;
    this.cols = Math.ceil(this.width / this.cellW) + 1;
    this.rows = Math.ceil(this.height / this.cellH) + 1;
    const cells = this.cols * this.rows;
    this.energy = new Float32Array(cells);
    this.red = new Float32Array(cells);
    this.green = new Float32Array(cells);
    this.blue = new Float32Array(cells);
    this.rampIndex = Math.min(RAMPS.length - 1, Math.max(0, Math.round(this.params.ramp)));
    this.atlas = new GlyphAtlas(RAMPS[this.rampIndex], this.cellW, this.cellH, this.fontPx, this.dpr);
    this.dust.forEach((d) => {
      if (d.mode === 0) {
        d.x = d.hx * this.width;
        d.y = d.hy * this.height;
      }
    });
    this.chooseSystemCenter(this.systemCenter.x || this.width / 2, this.systemCenter.y || this.height * 0.66);
    if (!this.pointer.isOver) this.pointer = { x: this.width / 2, y: this.height * 0.62, isOver: false };
  }

  setZone(topPx: number, bottomPx: number) {
    this.zoneTop = topPx;
    this.zoneBottom = Math.max(bottomPx, topPx + 80);
    this.chooseSystemCenter(this.systemCenter.x || this.width / 2, 0);
  }

  private chooseSystemCenter(x: number, _y: number) {
    void _y;
    const zoneHeight = this.zoneBottom > this.zoneTop ? this.zoneBottom - this.zoneTop : this.height * 0.4;
    // The outer orbit is a flattened ellipse; it has to fit the free band.
    const fit = Math.min(this.width * 0.47, zoneHeight / (2.1 * this.params.orbitFlatten));
    this.systemScale = fit * this.params.systemScale;
    this.systemCenter = {
      x: Math.min(Math.max(x, this.width * 0.3), this.width * 0.7),
      y: this.zoneBottom > this.zoneTop ? (this.zoneTop + this.zoneBottom) / 2 : this.height * 0.7,
    };
  }

  /** Starts a black hole at (x, y); anything solar-system-like gets pulled in. */
  hold(x: number, y: number) {
    if (this.phase === "holding") return;
    this.phase = "holding";
    this.holdS = 0;
    this.anchor = { x, y };
    this.dust.forEach((d) => {
      if (d.mode === 0) d.mode = 1;
    });
  }

  /** Gives up a hold without an explosion (for example when a touch turns into a scroll). */
  cancel() {
    if (this.phase !== "holding") return;
    this.phase = this.hasSystem ? "system" : "idle";
    this.dust.forEach((d) => {
      d.mode = 0;
      d.fade = 0;
    });
  }

  /** Lets go: the hole explodes and a new solar system forms around the release point. */
  release() {
    if (this.phase !== "holding") return;
    this.phase = "exploding";
    this.sinceReleaseS = 0;
    this.hasSystem = true;
    this.chooseSystemCenter(this.anchor.x, this.anchor.y);
    const speedUp = this.params.blastSpeed;
    const rnd = seeded(Math.floor(this.timeS * 1000));
    this.dust.forEach((d) => {
      const away = Math.atan2(d.y - this.anchor.y, d.x - this.anchor.x) + (rnd() - 0.5) * 1.2;
      const speed = (160 + rnd() * 780) * speedUp;
      d.mode = 2;
      d.vx = Math.cos(away) * speed;
      d.vy = Math.sin(away) * speed * 0.8;
      d.fade = 1;
      if (d.x === 0 && d.y === 0) { d.x = this.anchor.x; d.y = this.anchor.y; }
    });
    this.sparks.forEach((s) => {
      const a = rnd() * Math.PI * 2;
      const speed = (220 + rnd() * 900) * speedUp;
      s.x = this.anchor.x;
      s.y = this.anchor.y;
      s.vx = Math.cos(a) * speed;
      s.vy = Math.sin(a) * speed * 0.85;
      s.life = 0.9 + rnd() * 0.9;
    });
    this.systemAngle = PLANETS.map(() => rnd() * Math.PI * 2);
  }

  /** Shows a finished solar system straight away (used when the visitor asks for less motion). */
  showSystemNow() {
    this.chooseSystemCenter(this.width / 2, this.height * 0.66);
    this.anchor = { ...this.systemCenter };
    this.hasSystem = true;
    this.phase = "system";
    this.sinceReleaseS = 10;
  }

  step(dtS: number) {
    this.timeS += dtS;
    if (this.phase === "holding") this.holdS += dtS;
    if (this.phase === "exploding") {
      this.sinceReleaseS += dtS;
      if (this.sinceReleaseS > EXPLODE_S) this.phase = "system";
    } else if (this.phase === "system") {
      this.sinceReleaseS += dtS;
    }
    const { planetSpeed, diskSpeed } = this.params;
    PLANETS.forEach((p, i) => (this.systemAngle[i] += (Math.PI * 2 * dtS * planetSpeed) / p.periodS));
    this.belt.forEach((b) => (b.angle += b.speed * dtS * 0.5 * planetSpeed));
    this.disk.forEach((d) => (d.angle += dtS * (2.2 / Math.pow(d.radius, 1.5)) * 2.1 * diskSpeed));
    this.stepDust(dtS);
    this.sparks.forEach((s) => {
      if (s.life <= 0) return;
      s.life -= dtS;
      const drag = Math.exp(-dtS * 2.4);
      s.vx *= drag;
      s.vy *= drag;
      s.x += s.vx * dtS;
      s.y += s.vy * dtS;
    });
  }

  private holeRadius(): number {
    return Math.min(58, this.width * 0.045) * this.params.holeSize * (1 - Math.exp(-this.holdS * 2.4));
  }

  private isActive(d: Dust): boolean {
    return d.band ? d.rank < this.params.milkyWay : d.rank < this.params.starDensity / 3;
  }

  private stepDust(dtS: number) {
    const hole = this.holeRadius();
    const { pull: pullScale, starDrift } = this.params;
    this.dust.forEach((d) => {
      if (d.mode === 0) {
        d.x = d.hx * this.width + Math.sin(this.timeS * 0.2 + d.hue * 40) * 3 * starDrift;
        d.y = d.hy * this.height + Math.cos(this.timeS * 0.17 + d.hue * 31) * 3 * starDrift;
        d.fade = Math.min(1, d.fade + dtS * 0.8);
      } else if (d.mode === 1) {
        // Fall towards the hole along a spiral; whatever crosses the horizon is gone until the blast.
        const dx = this.anchor.x - d.x;
        const dy = this.anchor.y - d.y;
        const dist = Math.hypot(dx, dy) + 1;
        const pull = ((1800 + this.holdS * 5200) / (dist + 90)) * pullScale;
        d.vx += ((dx / dist) * pull - (dy / dist) * pull * 0.55) * dtS * 2.4;
        d.vy += ((dy / dist) * pull + (dx / dist) * pull * 0.55) * dtS * 2.4;
        d.vx *= Math.exp(-dtS * 0.7);
        d.vy *= Math.exp(-dtS * 0.7);
        d.x += d.vx * dtS;
        d.y += d.vy * dtS;
        if (dist < hole * 0.95 + 4) {
          d.mode = 2;
          d.fade = 0;
          d.vx = d.vy = 0;
        }
      } else if (this.phase === "exploding" || this.phase === "system") {
        d.vx *= Math.exp(-dtS * 1.6);
        d.vy *= Math.exp(-dtS * 1.6);
        d.x += d.vx * dtS;
        d.y += d.vy * dtS;
        d.fade -= dtS * 0.55;
        if (d.fade <= 0) {
          // Settled: drift back in as a fresh star at its home position.
          d.mode = 0;
          d.fade = 0;
          d.x = d.hx * this.width;
          d.y = d.hy * this.height;
        }
      }
    });
  }

  // ---- drawing into the character grid ----

  /** Adds light at (x, y), spread over `radiusPx` if given. The grid turns it into characters in render(). */
  splat(x: number, y: number, power: number, rgb: RGB, radiusPx = 0) {
    if (power <= 0.003) return;
    const cx = x / this.cellW;
    const cy = y / this.cellH;
    const reachX = radiusPx > 0 ? Math.ceil(radiusPx / this.cellW) + 1 : 0;
    const reachY = radiusPx > 0 ? Math.ceil(radiusPx / this.cellH) + 1 : 0;
    for (let j = -reachY; j <= reachY; j++) {
      for (let i = -reachX; i <= reachX; i++) {
        const col = Math.floor(cx) + i;
        const row = Math.floor(cy) + j;
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) continue;
        let weight = power;
        if (radiusPx > 0) {
          const dx = (col + 0.5) * this.cellW - x;
          const dy = (row + 0.5) * this.cellH - y;
          const d = Math.hypot(dx, dy) / (radiusPx + this.cellW * 0.4);
          weight = power * Math.max(0, 1 - d * d);
        }
        if (weight <= 0.003) continue;
        const index = row * this.cols + col;
        if (this.energy[index] === 0) this.touched.push(index);
        this.energy[index] += weight;
        this.red[index] += rgb[0] * weight;
        this.green[index] += rgb[1] * weight;
        this.blue[index] += rgb[2] * weight;
      }
    }
  }

  private carve(x: number, y: number, radiusPx: number) {
    const r2 = radiusPx * radiusPx;
    for (const index of this.touched) {
      const col = index % this.cols;
      const row = (index / this.cols) | 0;
      const dx = (col + 0.5) * this.cellW - x;
      const dy = (row + 0.5) * this.cellH - y;
      if (dx * dx + dy * dy < r2) this.energy[index] = 0.0001;
    }
  }

  orbitPoint(planet: number, angle: number, scale = 1): { x: number; y: number } {
    const radius = PLANETS[planet].orbit * this.systemScale * scale;
    return { x: this.systemCenter.x + Math.cos(angle) * radius, y: this.systemCenter.y + Math.sin(angle) * radius * this.params.orbitFlatten };
  }

  render(ctx: CanvasRenderingContext2D) {
    this.touched.length = 0;
    this.energy.fill(0);
    this.red.fill(0);
    this.green.fill(0);
    this.blue.fill(0);

    this.drawDust();
    drawSolarSystem(this);
    if (this.phase === "exploding") this.drawBlast();
    const sparkCount = Math.round(this.params.sparkAmount * SPARK_MAX);
    for (let k = 0; k < sparkCount; k++) {
      const s = this.sparks[k];
      if (s.life > 0) this.splat(s.x, s.y, Math.min(1, s.life) * 0.9, [255, 205 + s.hue * 40, 140 + s.hue * 90], 5);
    }
    if (this.phase === "holding") this.drawBlackHole();

    ctx.clearRect(0, 0, this.width, this.height);
    this.paintGrid(ctx);
    drawSystemLabels(this, ctx);
  }

  private paintGrid(ctx: CanvasRenderingContext2D) {
    const atlas = this.atlas;
    if (!atlas) return;
    const { exposure, gamma, floor, opacity, saturation } = this.params;
    const levels = RAMPS[this.rampIndex].length - 1;
    for (const index of this.touched) {
      const raw = this.energy[index];
      const power = raw * exposure;
      if (power < floor) continue;
      const level = Math.round(Math.pow(Math.min(1, power / 1.4), gamma) * levels);
      if (level === 0) continue;
      let r = this.red[index] / raw;
      let g = this.green[index] / raw;
      let b = this.blue[index] / raw;
      if (saturation !== 1) {
        const grey = r * 0.3 + g * 0.59 + b * 0.11;
        r = grey + (r - grey) * saturation;
        g = grey + (g - grey) * saturation;
        b = grey + (b - grey) * saturation;
      }
      ctx.globalAlpha = Math.min(1, (0.32 + power * 0.7) * opacity);
      const col = index % this.cols;
      const row = (index / this.cols) | 0;
      atlas.draw(ctx, level, Math.min(255, Math.max(0, r)) | 0, Math.min(255, Math.max(0, g)) | 0, Math.min(255, Math.max(0, b)) | 0, (col + 0.5) * this.cellW, (row + 0.55) * this.cellH);
    }
    ctx.globalAlpha = 1;
  }

  private drawDust() {
    const { starBrightness, starSize, twinkle, starClearing } = this.params;
    const cleared = this.hasSystem && this.phase !== "holding" ? starClearing * ease(clamp01((this.sinceReleaseS - 0.5) / 1.5)) : 0;
    const reach = this.systemScale * 0.9;
    this.dust.forEach((d) => {
      if (!this.isActive(d)) return;
      if (d.mode === 2 && this.phase === "holding") return; // swallowed
      const shimmer = d.mode === 0 ? 1 - twinkle * 0.35 * (1 - Math.sin(this.timeS * (1 + d.hue * 2) + d.hue * 50)) : 1;
      const size = d.size * starSize;
      const power = Math.max(0, Math.min(1, d.fade)) * shimmer * (0.34 + size * 0.25) * starBrightness * (d.band ? 0.55 : 1);
      let dim = 1;
      if (cleared > 0) {
        // Stars inside the solar system fade back, so the orbits and planets stand out.
        const e = Math.hypot((d.x - this.systemCenter.x) / reach, (d.y - this.systemCenter.y) / (reach * this.params.orbitFlatten));
        dim = 1 - cleared * (1 - ease(clamp01((e - 0.7) / 0.5)));
      }
      const warm = d.hue;
      const rgb: RGB = d.mode === 0 ? [170 + warm * 80, 190 + warm * 40, 255 - warm * 70] : [255, 215 + warm * 30, 170 + warm * 70];
      this.splat(d.x, d.y, power * dim, rgb, size > 1.6 ? (size - 1.6) * 3 : 0);
    });
  }

  private drawBlackHole() {
    const hole = this.holeRadius();
    if (hole < 2) return;
    const { diskDensity, diskBrightness, lensBrightness } = this.params;
    const grow = clamp01(this.holdS * 1.8);
    const tilt = -0.32;
    const sin = Math.sin(tilt);
    const cos = Math.cos(tilt);
    const diskCount = Math.min(DISK_MAX, Math.round(DISK_BASE * diskDensity));
    for (let k = 0; k < diskCount; k++) {
      const p = this.disk[k];
      const r = p.radius * hole;
      const ex = Math.cos(p.angle) * r;
      const ey = Math.sin(p.angle) * r * 0.27;
      const x = this.anchor.x + ex * cos - ey * sin;
      const y = this.anchor.y + ex * sin + ey * cos;
      const heat = 1 - clamp01((p.radius - 1.35) / 3.1);
      // The side turning towards us is brighter (the Doppler effect).
      const doppler = 0.65 + 0.35 * Math.cos(p.angle + 0.9);
      const rgb: RGB = [255, 150 + heat * 105, 90 + heat * 150 + p.hue * 20];
      const violet: RGB = [190 - heat * 30, 130, 255];
      this.splat(x, y, (0.22 + heat * 0.62) * doppler * grow * diskBrightness, heat > 0.45 ? rgb : violet, 3.2);
    }
    // Light bent over and under the hole, and the bright edge of the shadow.
    for (let a = 0; a < Math.PI * 2; a += 0.055) {
      const lens = hole * 1.34;
      this.splat(this.anchor.x + Math.cos(a) * lens * 1.04, this.anchor.y + Math.sin(a) * lens * 0.9, 0.42 * grow * lensBrightness, [255, 215, 245], 2);
      this.splat(this.anchor.x + Math.cos(a) * hole * 1.05, this.anchor.y + Math.sin(a) * hole * 1.05, 0.7 * grow * lensBrightness, [255, 255, 255], 1.5);
    }
    this.carve(this.anchor.x, this.anchor.y, hole * 0.96);
  }

  private drawBlast() {
    const t = this.sinceReleaseS;
    const { blastSpeed, flash: flashScale } = this.params;
    const flash = Math.exp(-t * 4.5);
    this.splat(this.anchor.x, this.anchor.y, flash * 2.2 * flashScale, [255, 244, 220], 90 * (1 - flash) + 18);
    const ringRadius = t * 980 * blastSpeed;
    const fade = Math.max(0, 1 - t / 1.25);
    for (let a = 0; a < Math.PI * 2; a += 0.035) {
      this.splat(this.anchor.x + Math.cos(a) * ringRadius, this.anchor.y + Math.sin(a) * ringRadius * 0.8, fade * 0.8, [225, 200, 255], 2.5);
    }
  }
}
