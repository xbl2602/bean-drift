import type { LunarName } from "../search/lunar-names";

// Names and coordinates always come from the bundled IAU/USGS catalog.
const FAMOUS_NAMES = [
  "Mare Tranquillitatis", "Mare Imbrium", "Mare Serenitatis", "Mare Crisium", "Oceanus Procellarum",
  "Tycho", "Copernicus", "Plato", "Aristarchus", "Shackleton", "Mons Malapert", "Mare Fecunditatis",
  "Mare Nectaris", "Mare Humorum", "Mare Frigoris", "Clavius", "Kepler", "Sinus Iridum", "Montes Apenninus",
  "Mare Orientale", "Tsiolkovskiy", "Von Kármán", "Mare Moscoviense", "Schrödinger", "Hertzsprung", "Korolev",
] as const;
const FAMOUS_RANK = new Map<string, number>(FAMOUS_NAMES.map((name, index) => [name, index]));
const DEGREES_PER_KM = 180 / (Math.PI * 1737.4);
const MIN_SCALE = [0, 10, 24, 65];
const MIN_SIZE_PX = [0, 22, 18, 14];

export interface LunarLabelFeature extends LunarName { tier: number; priority: number }
export interface LabelPoint { x: number; y: number }
export interface LabelRect { left: number; top: number; right: number; bottom: number }
export interface PlacedLunarLabel extends LabelPoint { feature: LunarLabelFeature; fontSize: number; opacity: number; box: LabelRect }
export interface LabelViewport { widthPx: number; heightPx: number; pixelsPerDegree: number }

export function prepareLunarLabels(names: readonly LunarName[]): LunarLabelFeature[] {
  return names.filter(n => n.name && Number.isFinite(n.latDeg) && Math.abs(n.latDeg) <= 90 && Number.isFinite(n.lonDeg) && Number.isFinite(n.diameterKm) && n.diameterKm >= 0).map(n => {
    const famous = FAMOUS_RANK.get(n.name);
    const tier = famous !== undefined ? 0 : n.featureType === "Satellite Feature" || n.diameterKm < 15 ? 3 : n.diameterKm >= 100 ? 1 : 2;
    return { ...n, tier, priority: famous ?? 1000 + tier };
  }).sort((a, b) => a.priority - b.priority || b.diameterKm - a.diameterKm || a.name.localeCompare(b.name, "en"));
}

const fade = (start: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / Math.max(start * 0.25, 1)));
  return t * t * (3 - 2 * t);
};
export const rectanglesOverlap = (a: LabelRect, b: LabelRect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Deterministic priorities, screen-space spacing and a small viewport-dependent budget. */
export function layoutLunarLabels(
  features: readonly LunarLabelFeature[],
  project: (point: LunarName) => LabelPoint | null,
  view: LabelViewport,
  blocked: readonly LabelRect[] = [],
  measure: (text: string, fontSize: number) => number = (text, size) => text.length * size * 0.56,
): PlacedLunarLabel[] {
  const placed: PlacedLunarLabel[] = [];
  const budget = Math.min(view.pixelsPerDegree < 12 ? 12 : view.pixelsPerDegree < 32 ? 20 : 32, Math.max(4, Math.floor(view.widthPx * view.heightPx / 34000)));
  for (const feature of features) {
    const sizePx = feature.diameterKm * DEGREES_PER_KM * view.pixelsPerDegree;
    const opacity = feature.tier === 0 ? 1 : fade(MIN_SCALE[feature.tier], view.pixelsPerDegree) * fade(MIN_SIZE_PX[feature.tier], sizePx);
    if (opacity < 0.2) continue;
    const p = project(feature);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const fontSize = feature.tier === 0 ? 11 : 10;
    const halfWidth = measure(feature.name, fontSize) / 2;
    const box = { left: p.x - halfWidth - 12, right: p.x + halfWidth + 12, top: p.y - 24, bottom: p.y + 7 };
    // Reserve the tool rail, top controls and bottom timeline; avoid clipped names.
    if (box.left < 92 || box.right > view.widthPx - 18 || box.top < 96 || box.bottom > view.heightPx - 96) continue;
    if (blocked.some(rect => rectanglesOverlap(box, rect)) || placed.some(label => rectanglesOverlap(box, label.box))) continue;
    placed.push({ feature, ...p, fontSize, opacity, box });
    if (placed.length >= budget) break;
  }
  return placed;
}
