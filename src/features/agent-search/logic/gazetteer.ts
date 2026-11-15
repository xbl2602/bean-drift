import fs from "node:fs";
import path from "node:path";

export interface LunarFeatureMatch {
  name: string;
  featureType: string;
  latDeg: number;
  lonDeg: number;
  diameterKm: number;
  distanceKm: number;
  withinFeatureRadius: boolean;
}

interface RawLunarEntry {
  name: string;
  featureType: string;
  latDeg: number;
  lonDeg: number;
  diameterKm: number;
  key: string;
}

const MOON_RADIUS_KM = 1737.4;
const FOLD_REGEX = /[\u0300-\u036f]/g;
const STOP_WORDS = new Set([
  "the", "and", "compare", "with", "other", "usual", "landing", "location", "locations",
  "site", "sites", "tell", "about", "what", "where", "show", "find", "near", "from",
  "south", "north", "pole", "lunar", "moon", "sun", "earth", "visibility", "conditions",
  "slope", "degrees", "degree", "latitude", "longitude", "point", "preset", "presets",
]);
const TYPE_ALIASES: Record<string, string> = {
  crater: "Crater", massif: "Mons", mountain: "Mons", mount: "Mons",
  peak: "Mons", valley: "Vallis", sea: "Mare", bay: "Sinus", lake: "Lacus",
};

let cachedEntries: RawLunarEntry[] | null = null;

function fold(text: string): string {
  return text.normalize("NFD").replace(FOLD_REGEX, "").toLowerCase().trim();
}

function loadEntries(): RawLunarEntry[] {
  if (cachedEntries) return cachedEntries;
  const candidates = [
    path.join(process.cwd(), "public/product/moon/lunar-names.json"),
    path.join(process.cwd(), "public/data/lunar-names.json"),
    path.join(process.cwd(), "public/data/v1/lunar-names.json"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { names?: Array<[string, string, number, number, number]> };
      if (Array.isArray(raw.names)) {
        cachedEntries = raw.names.map(([name, featureType, latDeg, lonDeg, diameterKm]) => ({
          name, featureType, latDeg, lonDeg, diameterKm, key: fold(name),
        }));
        return cachedEntries;
      }
    } catch {
      // Fall back safely if file cannot be read
    }
  }
  cachedEntries = [];
  return cachedEntries;
}

export function lunarDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const p1 = lat1 * toRad;
  const p2 = lat2 * toRad;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/** Find the closest named IAU lunar features to a given coordinate. */
export function findNearbyFeatures(latDeg: number, lonDeg: number, maxResults = 5, maxDistanceKm = 200): LunarFeatureMatch[] {
  const entries = loadEntries();
  if (!entries.length || !Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return [];
  const matches: LunarFeatureMatch[] = [];
  for (const item of entries) {
    const dist = lunarDistanceKm(latDeg, lonDeg, item.latDeg, item.lonDeg);
    const radius = Math.max(0, item.diameterKm / 2);
    if (dist <= maxDistanceKm || dist <= radius * 1.2) {
      matches.push({
        name: item.name,
        featureType: item.featureType,
        latDeg: item.latDeg,
        lonDeg: item.lonDeg,
        diameterKm: item.diameterKm,
        distanceKm: Number(dist.toFixed(1)),
        withinFeatureRadius: radius > 0 && dist <= radius,
      });
    }
  }
  matches.sort((a, b) => {
    if (a.withinFeatureRadius !== b.withinFeatureRadius) return a.withinFeatureRadius ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });
  return matches.slice(0, maxResults);
}

/** Extract coordinates mentioned in the user's question (e.g. "41.75°N 70.70°E" or "-89.9, 0") and find nearby IAU features. */
export function findFeaturesForPromptCoordinates(question: string): Array<{ queryCoord: { latDeg: number; lonDeg: number }; nearbyFeatures: LunarFeatureMatch[] }> {
  const out: Array<{ queryCoord: { latDeg: number; lonDeg: number }; nearbyFeatures: LunarFeatureMatch[] }> = [];
  const add = (lat: number, lon: number) => {
    if (out.length >= 4 || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    if (out.some(item => item.queryCoord.latDeg === lat && item.queryCoord.lonDeg === lon)) return;
    out.push({ queryCoord: { latDeg: lat, lonDeg: lon }, nearbyFeatures: findNearbyFeatures(lat, lon, 5, 200) });
  };
  const dirRegex = /(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])[\s,;]+(-?\d+(?:\.\d+)?)\s*°?\s*([EWew])/g;
  let match: RegExpExecArray | null;
  while ((match = dirRegex.exec(question)) !== null) {
    const lat = Math.abs(Number(match[1])) * (match[2].toUpperCase() === "S" ? -1 : 1);
    const lon = Math.abs(Number(match[3])) * (match[4].toUpperCase() === "W" ? -1 : 1);
    add(lat, lon);
  }
  // Explicit labels avoid confusing arbitrary numerical lists or dates with coordinates.
  const labelled = /\blat(?:itude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)\s*°?\s*[,;]?\s*lon(?:gitude)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)(?![\d.])/gi;
  while ((match = labelled.exec(question)) !== null) add(Number(match[1]), Number(match[2]));
  return out;
}

/** Extract mentioned IAU lunar feature names from a user's natural-language question. */
export function resolveFeaturesInQuestion(question: string, limit = 4): Array<{ name: string; featureType: string; latDeg: number; lonDeg: number; diameterKm: number }> {
  const entries = loadEntries();
  if (!entries.length) return [];
  const clean = fold(question).replace(/[^a-z0-9\s]/g, " ");
  const words = clean.split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !TYPE_ALIASES[w]);
  if (!words.length) return [];
  const preferredType = clean.split(/\s+/).map(w => TYPE_ALIASES[w]).find(Boolean);
  const scored: Array<{ item: RawLunarEntry; score: number }> = [];
  for (const item of entries) {
    if (item.key.length < 3 || item.featureType === "Satellite Feature") continue;
    if (` ${clean} `.includes(` ${item.key} `)) {
      let score = item.key.split(" ").length * 10 + Math.min(item.diameterKm, 500) / 100;
      if (preferredType && item.featureType === preferredType) score += 5;
      scored.push({ item, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out = [];
  for (const { item } of scored) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    out.push({ name: item.name, featureType: item.featureType, latDeg: item.latDeg, lonDeg: item.lonDeg, diameterKm: item.diameterKm });
    if (out.length >= limit) break;
  }
  return out;
}
