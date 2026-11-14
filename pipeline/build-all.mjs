// Runs every pipeline step and writes public/data/v1/manifest.json. Usage (from the repo root):  npm run data
// Needs data/raw/lola-global/ldem_64.img (see pipeline/README.md). Writes only inside public/data/v1/.
import { statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LDEM64, MAP, OUT_DIR } from './lib/lola-dem.mjs';
import { buildTerrain } from './build-terrain.mjs';
import { buildHorizon } from './build-horizon.mjs';
import { buildStats } from './build-stats.mjs';

console.log('1/3 terrain (height, slope, slope direction)'); const terrain = buildTerrain();
console.log('2/3 terrain horizon map'); const horizon = await buildHorizon();
console.log('3/3 one-year statistics'); const stats = await buildStats();

const files = {};
for (const f of [terrain.files.height, terrain.files.slope, terrain.files.aspect, horizon.file, stats.file]) files[f] = statSync(path.join(OUT_DIR, f)).size;

const manifest = {
  version: 1,
  generatedUtc: new Date().toISOString(),
  frame: 'Selenographic Mean-Earth / polar-axis (LOLA): latitude north+, longitude east+ in -180..180, height above the 1737.4 km reference sphere',
  grid: {
    ...MAP, layout: 'every plane is height x width, row 0 = north edge (lat +90), column 0 = west edge (lon -180); cell (row, col) covers lat 90-(row+1)/ppd..90-row/ppd, lon -180+col/ppd..-180+(col+1)/ppd',
    cellSizeM: 'about 7580 m north-south; east-west shrinks with cos(latitude)',
  },
  sources: {
    dem: {
      name: 'NASA LRO LOLA global DEM, LDEM_64', pixelsPerDegree: LDEM64.ppd, metresPerPixel: terrain.pixelBaselineM,
      url: 'https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_64.IMG', license: 'NASA data, public domain',
      citation: 'Smith et al. (2010), Space Sci. Rev. 150, 209-241 (LOLA); NASA PDS Geosciences Node',
    },
    ephemeris: stats.ephemeris,
  },
  terrain, horizon, stats, files,
  limitations: [
    'One value per 0.25 degree cell (about 7.6 km); a landing-site-scale question needs finer data than this.',
    'The horizon is computed from the cell centre only, in 32 compass directions (11.25 degree steps), so a narrow ridge between two directions can be missed.',
    'One year (2030) is not the worst year: the Moon\'s orbit has an 18.6 year cycle that changes how far Sun and Earth swing above and below the horizon at the poles.',
    'Sun and Earth positions are accurate to about 0.02 degrees, not mission-grade.',
  ],
};
writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('done: public/data/v1/manifest.json', files);
