import { createDemGrid, horizonProfile } from './demgrid.js';
import { EYE } from './common.js';
import { LUNAR_SKY, LUNAR_VIEW } from './sites.js';
import * as EPH from './ephemeris.js';

// Real LOLA data (NASA LRO): 10 m/px south-polar DEM + a baked low-sun shadow map.
// World frame = DEM image frame: x = column, z = row (down), y = height above the 1737.4 km reference sphere.
// The world origin is the lunar south pole.

// Camera stands at the pole and looks towards Shackleton crater (about 10 km away, 21 km wide, ~4.2 km deep).
// The sun sits 1.5 deg above the horizon (true polar illumination); sun azimuth was chosen from the horizon profile so
// the pole itself is lit while the crater interior stays in permanent-shadow-like darkness.
export const POLE = {
  camera: { ...LUNAR_VIEW, yaw: 128.5, pitch: 2.5, eye: EYE },
  sun: { az: 62, el: 1.5 },
  earth: LUNAR_SKY.earth,
  skyRadius: LUNAR_SKY.skyRadius,
};

// Gentler places inside the DEM crop, picked by tools/find_spot.py (x, z in metres from the pole, DEM image frame): smooth ground
// that also has the Sun and the Earth above the terrain horizon for much of the year (real ephemeris, 365 d from 2026-11-01).
// The pole itself: mean slope ~10 deg, Sun visible 32% of the year, Earth 16%, both 5%.
//   a: 8.9 km from the pole, 1298 m, mean slope 4.5 deg (+-100 m) / 7.7 deg (+-300 m), Sun 72%, Earth 79%, both 55%
//   b: 11.9 km from the pole,  930 m, mean slope 3.4 / 7.3 deg, Sun 63%, Earth 60%, both 37%
// From the south pole region the Earth always stands near azimuth 0 (the near side), within +-8 deg, so the cameras look that way.
export const SPOTS = {
  a: { x: 7895, z: -4105, camera: { yaw: 0, pitch: 3 } },
  b: { x: 11495, z: -2905, camera: { yaw: 0, pitch: 3 } },
};
export const R_MOON = 1737400;

export async function loadLola(status = () => {}, spot = null) {
  const ox = spot ? spot.x : 0, oz = spot ? spot.z : 0;     // the render world is centred on the camera: shift the DEM under it
  status('loading DEM…');
  const meta = await (await fetch('data/derived/dem_meta.json')).json();
  const raw = new Int16Array(await (await fetch('data/derived/dem_crop.i16')).arrayBuffer());
  const n = meta.n, px = meta.px, x0 = meta.x0, z0 = meta.z0;
  status('DEM mip pyramid…');
  await new Promise((r) => setTimeout(r, 16));
  const grid = createDemGrid({ data: raw, nx: n, nz: n, px, x0, z0, scale: meta.scale });
  // the render world is centred on the camera: the DEM is shifted under it by (ox, oz)
  const base = (x, z, spacing) => grid.sample(x + ox, z + oz, spacing);
  const horizon = (X, Z, maxDist = 14000) => horizonProfile(grid.sample, X, Z, { eye: EYE, px, R: R_MOON, maxDist });   // X, Z in the DEM frame
  status('shadow map…');
  const shadowImage = new Image();
  shadowImage.src = 'data/derived/shadow.png';
  await shadowImage.decode();
  // grid.levels[1] is the 2x2 mean of the 10 m data = a 20 m grid whose pixel (1050, 1050) is the pole: input for the shadow worker
  return { meta, base, horizon, shadowImage, bounds: [x0 - px / 2 - ox, z0 - px / 2 - oz, n * px], dem20: grid.levels[1].d, n20: grid.levels[1].nx, px20: px * 2, x20: x0 + px / 2, z20: z0 + px / 2 };
}

// Everything scene-three.js needs for a south-pole view (the pole itself, or ?spot=a|b), in the shape every site loader returns.
export async function loadPole(spotKey, status = () => {}) {
  const spot = SPOTS[spotKey] || null;
  const d = await loadLola(status, spot);
  const site = spot ? { x: spot.x, z: spot.z } : { x: 0, z: 0 };
  // the baked far-shadow mask (sun az 62, el 1.5) is what is shown until the worker has computed the current sun direction
  const cv = document.createElement('canvas'); cv.width = d.shadowImage.width; cv.height = d.shadowImage.height;
  const cx = cv.getContext('2d'); cx.drawImage(d.shadowImage, 0, 0);
  const px4 = cx.getImageData(0, 0, cv.width, cv.height).data, lit0 = new Uint8Array(cv.width * cv.height);
  for (let i = 0; i < lit0.length; i++) lit0[i] = px4[i * 4];
  return {
    id: spotKey ? 'pole-' + spotKey : 'pole',
    hudLabel: `REAL LOLA DEM (10 m)${spotKey && spot ? ' · spot ' + spotKey : ''}`,
    label: spot ? `spot ${spotKey}: ${(Math.hypot(site.x, site.z) / 1000).toFixed(1)} km from the pole` : 'viewpoint: south pole',
    camera: { ...POLE.camera, ...(spot ? spot.camera : {}) }, sun: POLE.sun, earth: POLE.earth, skyRadius: POLE.skyRadius,
    build: { terrain: { rMax: 21000, rings: 480, segs: 720, base: d.base, maxFeatureR: 9, curvature: R_MOON }, rocks: 300, pebbles: 700 },
    far: { lit0, litW: cv.width, litH: cv.height, bounds: d.bounds, dem: d.dem20, n: d.n20, px: d.px20, x0: d.x20, z0: d.z20 },
    horizon: d.horizon(site.x, site.z),
    sky: (ms) => EPH.skyAt(ms, site.x, site.z),
    shadowSun: (ms) => EPH.skyAt(ms, 0, 0).sun,                  // far shadows are cast in the tangent plane at the pole
    defaultT: Date.UTC(2026, 10, 19, 7, 20),                      // Sun at az 62, where the pole view was tuned
    elRange: 9,                                                   // the Sun stays within a few degrees of the horizon all year
    exposure: () => 1, starGain: () => 1,
  };
}
