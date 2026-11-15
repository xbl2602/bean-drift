// Line of sight between the satellite and the surface bases, using real terrain.
//
// A base can be linked only if the satellite is above its horizon (with a small elevation margin)
// and no terrain (a ridge, a crater rim, the curve of the Moon itself) rises into the straight line
// between them. Heights come from a 2048 x 1024 map made from NASA's LOLA elevation data
// (public/landing/moon-height-2k.png: 8 bits covering -9200 m to +10800 m).
// Everything here works in the Moon's own frame, in scene units where the Moon's radius is MOON_RADIUS.

export const MOON_RADIUS = 100; // scene units
const MOON_RADIUS_M = 1_737_400;
const HEIGHT_MIN_M = -9200;
const HEIGHT_RANGE_M = 20000;
const MIN_ELEVATION_DEG = 7;

export type Vec3 = [number, number, number];

export class TerrainHeights {
  private data: Uint8ClampedArray | null = null;
  private width = 0;
  private height = 0;

  async load(url: string): Promise<void> {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    this.data = pixels.data;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  /** Terrain height in metres at a direction (unit vector in the Moon's frame); 0 until the map has loaded. */
  heightM(direction: Vec3): number {
    if (!this.data) return 0;
    const lon = Math.atan2(direction[0], direction[2]);
    const lat = Math.asin(Math.max(-1, Math.min(1, direction[1])));
    const x = ((lon / (2 * Math.PI) + 0.5) * this.width) - 0.5;
    const y = ((0.5 - lat / Math.PI) * this.height) - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.max(0, Math.min(this.height - 2, Math.floor(y)));
    const fx = x - x0;
    const fy = Math.max(0, Math.min(1, y - y0));
    const at = (px: number, py: number) => this.data![(py * this.width + ((px + this.width) % this.width)) * 4];
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return HEIGHT_MIN_M + ((top * (1 - fy) + bottom * fy) / 255) * HEIGHT_RANGE_M;
  }

  /** Radius of the ground in scene units at a direction. */
  radius(direction: Vec3): number {
    return MOON_RADIUS * (1 + this.heightM(direction) / MOON_RADIUS_M);
  }
}

export function directionFromLatLon(latDeg: number, lonDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)];
}

export type Visibility = { visible: boolean; elevationDeg: number; distance: number };

/** Can a base at `direction` see a satellite at `satellite` (both in the Moon's frame)? */
export function canSee(terrain: TerrainHeights, direction: Vec3, satellite: Vec3): Visibility {
  const baseRadius = terrain.radius(direction) + 0.02;
  const base: Vec3 = [direction[0] * baseRadius, direction[1] * baseRadius, direction[2] * baseRadius];
  const toSat: Vec3 = [satellite[0] - base[0], satellite[1] - base[1], satellite[2] - base[2]];
  const distance = Math.hypot(...toSat);
  const sinElevation = (toSat[0] * direction[0] + toSat[1] * direction[1] + toSat[2] * direction[2]) / distance;
  const elevationDeg = (Math.asin(Math.max(-1, Math.min(1, sinElevation))) * 180) / Math.PI;
  if (elevationDeg < MIN_ELEVATION_DEG) return { visible: false, elevationDeg, distance };

  // Walk along the line: if the ground at any point is higher than the line, the view is blocked.
  const samples = 40;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    // Samples are denser near the base, where ridges matter most.
    const s = t * t;
    const px = base[0] + toSat[0] * s;
    const py = base[1] + toSat[1] * s;
    const pz = base[2] + toSat[2] * s;
    const r = Math.hypot(px, py, pz);
    const ground = terrain.radius([px / r, py / r, pz / r]);
    if (r < ground) return { visible: false, elevationDeg, distance };
  }
  return { visible: true, elevationDeg, distance };
}

export const MAX_BASE_LINKS = 2;

/**
 * Chooses which bases are linked this frame: never more than MAX_BASE_LINKS. A base that is already
 * linked keeps its slot while it stays visible (links do not flicker between neighbours); a free slot
 * goes to the nearest visible base that is not linked yet.
 */
export function chooseLinks(current: string[], visibleNearestFirst: string[]): string[] {
  const visible = new Set(visibleNearestFirst);
  const kept = current.filter((id) => visible.has(id));
  const next = [...kept];
  for (const id of visibleNearestFirst) {
    if (next.length >= MAX_BASE_LINKS) break;
    if (!next.includes(id)) next.push(id);
  }
  return next;
}
