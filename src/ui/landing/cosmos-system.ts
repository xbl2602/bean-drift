// The solar system in the closing ASCII scene: dotted orbits, the asteroid belt, a Sun with flaring
// rays, and planets drawn as lit balls (banded Jupiter, ringed Saturn, Earth with its Moon) so each
// one can be told apart even though it is made of a handful of characters.
// Drawing goes through AsciiCosmos.splat, which adds light to the character grid.

import type { AsciiCosmos } from "./ascii-cosmos";

export type RGB = readonly [number, number, number];
type Planet = { name: string; au: number; color: RGB; sizePx: number; orbit: number; periodS: number; ring?: boolean; bands?: boolean; moon?: boolean };

// Orbit sizes are spread out for the picture; periods are sped up and only roughly ordered like the real ones.
export const PLANETS: Planet[] = [
  { name: "Mercury", au: 0.39, color: [190, 180, 170], sizePx: 2.4, orbit: 0.115, periodS: 4.5 },
  { name: "Venus", au: 0.72, color: [255, 214, 140], sizePx: 3.9, orbit: 0.17, periodS: 7 },
  { name: "Earth", au: 1, color: [96, 178, 255], sizePx: 4.2, orbit: 0.23, periodS: 10, moon: true },
  { name: "Mars", au: 1.52, color: [238, 118, 78], sizePx: 3.2, orbit: 0.295, periodS: 15 },
  { name: "Jupiter", au: 5.2, color: [238, 190, 140], sizePx: 9.6, orbit: 0.43, periodS: 27, bands: true },
  { name: "Saturn", au: 9.54, color: [240, 222, 160], sizePx: 8, orbit: 0.56, periodS: 38, ring: true, bands: true },
  { name: "Uranus", au: 19.2, color: [150, 236, 240], sizePx: 5.6, orbit: 0.68, periodS: 52 },
  { name: "Neptune", au: 30.1, color: [110, 140, 255], sizePx: 5.4, orbit: 0.8, periodS: 66 },
];

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** How far the picture shifts with the pointer. */
export function parallax(c: AsciiCosmos): { x: number; y: number } {
  if (!c.pointer.isOver) return { x: 0, y: 0 };
  const k = 0.35 * c.params.tilt;
  return { x: (c.pointer.x / c.width - 0.5) * 14 * k, y: (c.pointer.y / c.height - 0.5) * 8 * k };
}

/** Light a ball made of character cells: bright on the side facing (sunX, sunY), with optional bands. */
function drawBall(c: AsciiCosmos, x: number, y: number, radius: number, color: RGB, intensity: number, sunX: number, sunY: number, banded: boolean) {
  const toSun = Math.hypot(sunX - x, sunY - y) || 1;
  const lx = ((sunX - x) / toSun) * 0.8;
  const ly = ((sunY - y) / toSun) * 0.8;
  const col0 = Math.floor(x / c.cellW);
  const row0 = Math.floor(y / c.cellH);
  const reachX = Math.ceil(radius / c.cellW) + 1;
  const reachY = Math.ceil(radius / c.cellH) + 1;
  for (let j = -reachY; j <= reachY; j++) {
    for (let i = -reachX; i <= reachX; i++) {
      const px = (col0 + i + 0.5) * c.cellW;
      const py = (row0 + j + 0.5) * c.cellH;
      const nx = (px - x) / radius;
      const ny = (py - y) / radius;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1.12) continue;
      const z = Math.sqrt(Math.max(0, 1 - d2));
      const shade = 0.2 + 0.95 * Math.max(0, nx * lx + ny * ly + z * 0.55);
      const band = banded ? 0.72 + 0.28 * Math.sin(ny * 11 + Math.sin(nx * 3) * 0.6) : 1;
      c.splat(px, py, intensity * shade * (d2 > 1 ? 0.5 : 1), [color[0] * band, color[1] * band, color[2] * band], 0);
    }
  }
}

function drawRings(c: AsciiCosmos, x: number, y: number, radius: number, color: RGB, intensity: number) {
  const tilt = -0.38;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  for (const [scale, power] of [[1.75, 0.62], [2.15, 0.46]] as const) {
    const ringRadius = radius * scale;
    const step = Math.max(0.05, (c.cellW * 0.8) / ringRadius);
    for (let a = 0; a < Math.PI * 2; a += step) {
      const ex = Math.cos(a) * ringRadius;
      const ey = Math.sin(a) * ringRadius * 0.3;
      const rx = ex * cos - ey * sin;
      const ry = ex * sin + ey * cos;
      if (Math.sin(a) < 0 && Math.hypot(rx, ry * 1.4) < radius) continue; // the far side passes behind the planet
      c.splat(x + rx, y + ry, power * intensity, color, 0);
    }
  }
}

export function drawSolarSystem(c: AsciiCosmos) {
  if (!c.hasSystem || (c.phase === "holding" && c.holdS > 1.4)) return;
  const { params } = c;
  const swallowing = c.phase === "holding";
  const t = c.sinceReleaseS;
  const center = c.systemCenter;
  const shift = parallax(c);

  // Each body is pulled into the hole when one forms (outer ones first), or flies out of the blast.
  const placement = (x: number, y: number, order: number, formed = 1) => {
    if (!swallowing && formed < 1) {
      return { x: c.anchor.x + (x - c.anchor.x) * formed, y: c.anchor.y + (y - c.anchor.y) * formed, visible: 1 };
    }
    if (swallowing) {
      const s = ease(clamp01((c.holdS - 0.12 * (7 - order)) / 0.9));
      const twist = s * 2.2;
      const dx = x - c.anchor.x;
      const dy = y - c.anchor.y;
      return {
        x: c.anchor.x + (dx * Math.cos(twist) - dy * Math.sin(twist)) * (1 - s),
        y: c.anchor.y + (dx * Math.sin(twist) + dy * Math.cos(twist)) * (1 - s),
        visible: 1 - s,
      };
    }
    return { x, y, visible: 1 };
  };
  const formedAt = (i: number) => ease(clamp01((t - 0.55 - i * 0.1) / 1.4));

  // Orbits.
  PLANETS.forEach((p, i) => {
    const formed = formedAt(i);
    if (formed <= 0.01) return;
    const a = p.orbit * c.systemScale * formed;
    const b = a * params.orbitFlatten;
    const count = Math.ceil((Math.PI * 2 * Math.sqrt((a * a + b * b) / 2)) / (c.cellW * params.orbitSpacing));
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2;
      const place = placement(center.x + Math.cos(angle) * a + shift.x, center.y + Math.sin(angle) * b + shift.y, i, formed);
      c.splat(place.x, place.y, 0.15 * params.orbitBrightness * place.visible * formed, [100, 135, 205], 0);
    }
  });

  // Asteroid belt between Mars and Jupiter.
  const beltFormed = ease(clamp01((t - 1.3) / 1.5));
  const beltCount = Math.round(params.beltDensity * 150);
  for (let k = 0; k < beltCount; k++) {
    const rock = c.belt[k];
    const radius = rock.radius * c.systemScale * beltFormed;
    const place = placement(center.x + Math.cos(rock.angle) * radius + shift.x, center.y + Math.sin(rock.angle) * radius * params.orbitFlatten + shift.y, 3, beltFormed);
    c.splat(place.x, place.y, 0.34 * place.visible * beltFormed, [196, 178, 150], 0);
  }

  // The Sun: a disc with granulation, a glow, and rays that flare.
  const sunGrow = ease(clamp01((t - 0.3) / 0.9));
  const sunRadius = Math.max(12, c.systemScale * 0.036) * params.sunSize * sunGrow;
  const sun = placement(center.x + shift.x, center.y + shift.y, 7, sunGrow);
  if (sunGrow > 0.01) {
    const reach = 1 + 0.9 * params.coronaSize;
    const cellsX = Math.ceil((sunRadius * reach) / c.cellW) + 1;
    const cellsY = Math.ceil((sunRadius * reach) / c.cellH) + 1;
    for (let j = -cellsY; j <= cellsY; j++) {
      for (let i = -cellsX; i <= cellsX; i++) {
        const x = sun.x + i * c.cellW;
        const y = sun.y + j * c.cellH;
        const d = Math.hypot(i * c.cellW, j * c.cellH) / sunRadius;
        if (d > reach) continue;
        const flicker = 0.78 + 0.22 * Math.sin(c.timeS * 3 + i * 1.7 + j * 2.3) * Math.sin(c.timeS * 1.3 + i * 0.6);
        const power = d < 1 ? (1.35 - 0.45 * d * d) * flicker : 0.55 * Math.exp(-(d - 1) * 3.2) * flicker;
        c.splat(x, y, power * sun.visible * params.sunBrightness, d < 1 ? [255, 218 - d * 70, 96 - d * 44] : [255, 156, 72], 0);
      }
    }
    const rays = 18;
    for (let k = 0; k < rays; k++) {
      const angle = (k / rays) * Math.PI * 2 + c.timeS * (k % 2 ? 0.07 : -0.05);
      const length = sunRadius * (1.25 + params.coronaSize * (0.45 + 0.45 * Math.sin(c.timeS * 1.7 + k * 2.1)));
      for (let s = sunRadius * 0.95; s < length; s += c.cellW * 0.9) {
        const fade = Math.pow(1 - (s - sunRadius * 0.95) / Math.max(1, length - sunRadius * 0.95), 1.4);
        c.splat(sun.x + Math.cos(angle) * s, sun.y + Math.sin(angle) * s * 0.9, 0.5 * fade * sun.visible * params.sunBrightness, [255, 190, 100], 0);
      }
    }
  }

  // Planets, drawn from the far side of their orbits first so near ones overlap far ones.
  const order = PLANETS.map((_, i) => i).sort((a, b) => Math.sin(c.systemAngle[a]) - Math.sin(c.systemAngle[b]));
  for (const i of order) {
    const p = PLANETS[i];
    const formed = formedAt(i);
    if (formed <= 0.01) continue;
    const angle = c.systemAngle[i] + (1 - formed) * 3.4;
    const point = c.orbitPoint(i, angle, formed);
    const place = placement(point.x + shift.x, point.y + shift.y, i, formed);
    const radius = Math.max(p.sizePx * params.planetSize, c.cellH * 0.62) * (0.7 + 0.3 * formed);
    const intensity = 1.1 * params.planetBrightness * place.visible * formed;
    drawBall(c, place.x, place.y, radius, p.color, intensity, sun.x, sun.y, Boolean(p.bands));
    if (p.ring) drawRings(c, place.x, place.y, radius, p.color, intensity);
    if (p.moon && params.showMoon > 0) {
      const moonAngle = c.timeS * 2.4;
      const moonRadius = Math.max(c.cellH * 0.45, radius * 0.3);
      drawBall(c, place.x + Math.cos(moonAngle) * radius * 2.5, place.y + Math.sin(moonAngle) * radius * 1.3, moonRadius, [205, 205, 200], intensity * 0.9, sun.x, sun.y, false);
    }
  }
}

/** Planet names (always on, or only near the pointer), drawn straight onto the canvas rather than into the grid. */
export function drawSystemLabels(c: AsciiCosmos, ctx: CanvasRenderingContext2D) {
  c.hoverName = "";
  if (c.phase !== "system" && c.phase !== "exploding") return;
  const { params } = c;
  const shift = parallax(c);
  const size = Math.max(9, 10.5 * params.labelSize);
  const positions = PLANETS.map((p, i) => {
    const formed = ease(clamp01((c.sinceReleaseS - 0.55 - i * 0.1) / 1.4));
    const point = c.orbitPoint(i, c.systemAngle[i], formed);
    return { x: point.x + shift.x, y: point.y + shift.y, formed, radius: Math.max(p.sizePx * params.planetSize, c.cellH * 0.62) };
  });
  let hovered = -1;
  let bestDistance = 34;
  if (c.phase === "system" && c.pointer.isOver) {
    positions.forEach((pos, i) => {
      const d = Math.hypot(pos.x - c.pointer.x, pos.y - c.pointer.y);
      if (d < bestDistance) {
        bestDistance = d;
        hovered = i;
      }
    });
  }
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `600 ${size}px ui-monospace, Menlo, Consolas, monospace`;
  PLANETS.forEach((p, i) => {
    const pos = positions[i];
    if (pos.formed < 0.95 || i === hovered) return;
    if (params.labelsAlways <= 0) return;
    ctx.fillStyle = `rgba(${p.color.join(",")},0.78)`;
    ctx.fillText(p.name.toUpperCase(), pos.x + pos.radius + 5, pos.y - pos.radius * 0.7 - 3);
  });
  if (hovered < 0) return;
  const p = PLANETS[hovered];
  const pos = positions[hovered];
  c.hoverName = p.name;
  const text = `${p.name.toUpperCase()}  ${p.au} AU`;
  ctx.font = `600 ${size * 1.2}px ui-monospace, Menlo, Consolas, monospace`;
  const x = pos.x + 16;
  const y = pos.y - 20;
  const width = ctx.measureText(text).width + 14;
  ctx.fillStyle = "rgba(5,9,20,0.86)";
  ctx.strokeStyle = `rgb(${p.color.join(",")})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(x, y - size * 1.2, width, size * 2.3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = `rgb(${p.color.join(",")})`;
  ctx.fillText(text, x + 7, y);
}
