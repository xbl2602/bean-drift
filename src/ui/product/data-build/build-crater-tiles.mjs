// Offline build: cuts the real Robbins lunar crater catalogue into small 10 x 10 degree tiles that the
// first-person view loads around the spot where you stand, so the big craters you see are real ones
// at their real positions and sizes.
//
// Source: Robbins, S. J. (2019), "A New Global Database of Lunar Impact Craters >1-2 km", JGR Planets
//   (USGS Astrogeology "Moon Crater Database v1 Robbins", file lunar_crater_database_robbins_2018.csv,
//   about 2 million craters; every crater of 1 km or more is kept here, about 1.3 million).
//
// Run (from the repository root), giving the path of the unzipped CSV:
//   node src/ui/product/data-build/build-crater-tiles.mjs path/to/lunar_crater_database_robbins_2018.csv
// Writes public/product/moon/craters/{row}-{col}.bin and craters-meta.json.
//
// Tile naming matches the height tiles: row 0 = 90N..80N, col 0 = 180W..170W (10 degrees each).
// File layout (little endian), N craters sorted from the biggest to the smallest:
//   uint32 N, then uint16[N] latitude, uint16[N] longitude (both = position inside the tile, 0..65535 over 10 deg),
//   uint16[N] diameter in units of 0.04 km, uint8[N] rim completeness (0..255 = 0..1; low = worn down, high = crisp).

import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node build-crater-tiles.mjs <lunar_crater_database_robbins_2018.csv>");
  process.exit(1);
}
const OUT = path.join(process.cwd(), "public", "product", "moon", "craters");
mkdirSync(OUT, { recursive: true });

const TILE_DEG = 10;
const ROWS = 180 / TILE_DEG;
const COLS = 360 / TILE_DEG;
const MIN_DIAMETER_KM = 1;
const DIAMETER_UNIT_KM = 0.04;

const tiles = new Map();
let header = null;
let kept = 0;
let total = 0;

const lines = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
for await (const line of lines) {
  if (!header) {
    header = line.split(",");
    continue;
  }
  const f = line.split(",");
  total++;
  const lat = Number(f[header.indexOf("LAT_CIRC_IMG")]);
  let lon = Number(f[header.indexOf("LON_CIRC_IMG")]);
  const diameterKm = Number(f[header.indexOf("DIAM_CIRC_IMG")]);
  const arc = Number(f[header.indexOf("ARC_IMG")]);
  if (!(diameterKm >= MIN_DIAMETER_KM) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  if (lon >= 180) lon -= 360; // the catalogue uses 0..360 east
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor((90 - lat) / TILE_DEG)));
  const col = Math.min(COLS - 1, Math.max(0, Math.floor((lon + 180) / TILE_DEG)));
  const south = 90 - (row + 1) * TILE_DEG;
  const west = -180 + col * TILE_DEG;
  const key = `${row}-${col}`;
  let list = tiles.get(key);
  if (!list) tiles.set(key, (list = []));
  list.push({
    lat: Math.min(65535, Math.max(0, Math.round(((lat - south) / TILE_DEG) * 65535))),
    lon: Math.min(65535, Math.max(0, Math.round(((lon - west) / TILE_DEG) * 65535))),
    diameter: Math.min(65535, Math.round(diameterKm / DIAMETER_UNIT_KM)),
    arc: Math.min(255, Math.max(0, Math.round((Number.isFinite(arc) ? arc : 0.5) * 255))),
  });
  kept++;
}

let bytes = 0;
for (const [key, list] of tiles) {
  list.sort((a, b) => b.diameter - a.diameter);
  const n = list.length;
  const buffer = Buffer.alloc(4 + n * 7);
  buffer.writeUInt32LE(n, 0);
  list.forEach((c, i) => {
    buffer.writeUInt16LE(c.lat, 4 + i * 2);
    buffer.writeUInt16LE(c.lon, 4 + n * 2 + i * 2);
    buffer.writeUInt16LE(c.diameter, 4 + n * 4 + i * 2);
    buffer.writeUInt8(c.arc, 4 + n * 6 + i);
  });
  writeFileSync(path.join(OUT, `${key}.bin`), buffer);
  bytes += buffer.length;
}

const meta = {
  version: 1,
  tileDeg: TILE_DEG,
  rows: ROWS,
  cols: COLS,
  diameterUnitKm: DIAMETER_UNIT_KM,
  minDiameterKm: MIN_DIAMETER_KM,
  craters: kept,
  tiles: tiles.size,
  layout: "uint32 N; uint16[N] lat; uint16[N] lon (position inside the tile, 0..65535 over tileDeg); uint16[N] diameter (x diameterUnitKm); uint8[N] rim completeness (0..255); sorted biggest first",
  tileOrigin: "row 0 = 90N..80N, col 0 = 180W..170W",
  source: {
    name: "Robbins lunar crater database 2018 (USGS Astrogeology, Moon Crater Database v1 Robbins)",
    citation: "Robbins, S. J. (2019), A New Global Database of Lunar Impact Craters >1-2 km: 1. Crater Locations and Sizes, Comparisons With Published Databases, and Global Analysis, JGR Planets 124, 871-892, doi:10.1029/2018JE005592",
    url: "https://astrogeology.usgs.gov/search/map/moon_crater_database_v1_robbins",
  },
};
writeFileSync(path.join(OUT, "craters-meta.json"), JSON.stringify(meta, null, 2));
console.log(`${total} rows read, ${kept} craters >= ${MIN_DIAMETER_KM} km kept in ${tiles.size} tiles, ${(bytes / 1e6).toFixed(1)} MB in total`);
