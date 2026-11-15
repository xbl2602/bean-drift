// 极区（80°S 到极点）160 m 地形：数据文件完整、读出的数和 NASA 40 m 原始高度图一致、边界和地平线行为正确。
// 参考数是"从原始 40 m 高度图独立算出来的"，不是从打包文件读的：取格子对应的 4x4 个像素求平均（高度），
// 取 pipeline 的坡度图按 0.25° 取整（坡度）。怎么得到的见 pipeline/validate-polar.mjs 的 A 部分。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { installTypescriptLoader, repoRoot } = require('./load-typescript-for-tests.cjs');
installTypescriptLoader();
const fs = require('node:fs');
const path = require('node:path');
const polar = require('../polar-terrain.ts');
const { chooseTerrainSource, TERRAIN_SOURCES } = require('../terrain-source-routing.ts');

const MOON_R_M = 1737400, DEG = Math.PI / 180;
const grid = polar.loadPolarGrid();
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'data', 'polar-v1', 'manifest.json'), 'utf8'));

/** 格子 (row, col) 的中心在哪个纬度、经度（极射赤面反投影，和 pipeline/lib/polar-dem.mjs 的 planeToLatLon 一样）。 */
function cellCentreLatLon(row, col) {
  const xM = (col - manifest.grid.centreCell) * manifest.grid.cellM, yM = (manifest.grid.centreCell - row) * manifest.grid.cellM;
  const radiusM = Math.hypot(xM, yM);
  return { latDeg: ((2 * Math.atan(radiusM / (2 * MOON_R_M))) / DEG) - 90, lonDeg: Math.atan2(xM, yM) / DEG };
}
const sha256 = (typed) => createHash('sha256').update(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)).digest('hex');

test('the packaged files decode to exactly the arrays the manifest describes', () => {
  const total = manifest.grid.sizeCells ** 2;
  assert.equal(grid.heights.length, total);
  assert.equal(grid.slopes.length, total);
  assert.equal(sha256(grid.heights), manifest.height.decodedSha256);
  assert.equal(sha256(grid.slopes), manifest.slope.decodedSha256);
  assert.ok(manifest.height.bytes + manifest.slope.bytes < 20e6, 'the polar data should stay small (about 17 MB)');
});

// 参考：[名称, 行, 列, 原始 40 m 高度图 4x4 平均 (m), 坡度 (度，0.25 取整)]
const REFERENCE_CELLS = [
  ['Shackleton centre', 1940, 1948, -2784.5, 4.75],
  ['Malapert massif', 1138, 1877, 4927, 6.5],
  ['Ridge A', 1874, 1948, 1299.5, 3.25],
  ['Haworth centre', 1418, 1856, -3314, 7.25],
  ['Cabeus centre', 1243, 1305, -3711, 20.75],
  ['Mons Mouton', 1022, 2427, 5048, 12.25],
  ['near 80 S edge', 2219, 3714, -2164.5, 2],
];

test('height and slope at a cell centre equal the values computed from the raw 40 m DEM', () => {
  for (const [name, row, col, heightM, slopeDeg] of REFERENCE_CELLS) {
    const { latDeg, lonDeg } = cellCentreLatLon(row, col);
    const terrain = polar.readPolarTerrainAt(grid, latDeg, lonDeg);
    assert.ok(Math.abs(terrain.heightM - heightM) < 0.01, `${name} height ${terrain.heightM} vs ${heightM}`);
    assert.ok(Math.abs(terrain.slopeDeg - slopeDeg) < 0.01, `${name} slope ${terrain.slopeDeg} vs ${slopeDeg}`);
    assert.equal(terrain.resolutionM, 160);
  }
});

test('between cell centres the height is a smooth blend of the neighbours', () => {
  const [, row, col] = REFERENCE_CELLS[2];
  const a = cellCentreLatLon(row, col), b = cellCentreLatLon(row, col + 1), mid = { latDeg: (a.latDeg + b.latDeg) / 2, lonDeg: (a.lonDeg + b.lonDeg) / 2 };
  const ha = polar.readPolarTerrainAt(grid, a.latDeg, a.lonDeg).heightM, hb = polar.readPolarTerrainAt(grid, b.latDeg, b.lonDeg).heightM;
  const hm = polar.readPolarTerrainAt(grid, mid.latDeg, mid.lonDeg).heightM;
  assert.ok(hm >= Math.min(ha, hb) - 1 && hm <= Math.max(ha, hb) + 1, `${hm} should lie between ${ha} and ${hb}`);
});

test('the pole and the 80 S boundary are readable; places north of 80 S are not this source', () => {
  for (const [latDeg, lonDeg] of [[-90, 0], [-90, 123], [-89.99999, -45], [-80, 0], [-80, 90], [-80, 180], [-80, -90]]) {
    const terrain = polar.readPolarTerrainAt(grid, latDeg, lonDeg);
    assert.ok(Number.isFinite(terrain.heightM) && Number.isFinite(terrain.slopeDeg), `${latDeg}, ${lonDeg}`);
  }
  assert.throws(() => polar.readPolarTerrainAt(grid, -79, 0), /outside the polar terrain data/);
  const polarSource = TERRAIN_SOURCES.find((s) => s.id === 'polar-160m');
  assert.equal(polarSource.covers(-80, 10), true);
  assert.equal(polarSource.covers(-79.999, 10), false);
  assert.equal(polarSource.covers(-90, 0), true);
  assert.equal(polarSource.covers(-85, 179.999), true);
  assert.equal(polarSource.covers(0, 0), false);
  assert.equal(polarSource.covers(90, 0), false);
});

test('routing: south of (and on) 80 S uses the polar source, everything else the global one', () => {
  assert.deepEqual(TERRAIN_SOURCES.map((s) => s.id), ['polar-160m', 'global-0.25deg']);
  for (const [latDeg, lonDeg, id] of [[-90, 0, 'polar-160m'], [-89.9, 129.8, 'polar-160m'], [-80.01, 40, 'polar-160m'], [-80, 40, 'polar-160m'], [-79.99, 40, 'global-0.25deg'], [0, 180, 'global-0.25deg'], [90, 0, 'global-0.25deg']]) {
    assert.equal(chooseTerrainSource(latDeg, lonDeg).id, id, `${latDeg}, ${lonDeg}`);
  }
});

test('the downhill direction points downhill', () => {
  // 取一个坡度明显的点（Cabeus 中心，坡度约 20°）：往下坡方向走一小段，高度应该变低
  const { latDeg, lonDeg } = cellCentreLatLon(REFERENCE_CELLS[4][1], REFERENCE_CELLS[4][2]);
  const here = polar.readPolarTerrainAt(grid, latDeg, lonDeg);
  assert.ok(here.aspectDeg !== null && here.aspectDeg >= 0 && here.aspectDeg < 360);
  const stepDeg = 0.003; // 约 90 m
  const north = Math.cos(here.aspectDeg * DEG), east = Math.sin(here.aspectDeg * DEG);
  const lat2 = latDeg + stepDeg * north, lon2 = lonDeg + (stepDeg * east) / Math.cos(latDeg * DEG);
  assert.ok(polar.readPolarTerrainAt(grid, lat2, lon2).heightM < here.heightM, 'moving along the downhill direction should lose height');
});

test('horizon profile: 90 azimuths, sane values, and the same point gives the same answer twice', () => {
  const noOutside = () => { throw new Error('should not leave the polar map from here'); };
  const a = polar.computePolarHorizonProfile(grid, -89.9, 129.8, noOutside), b = polar.computePolarHorizonProfile(grid, -89.9, 129.8, noOutside);
  assert.equal(a.length, 90);
  assert.deepEqual(a, b);
  for (const v of a) assert.ok(v > -10 && v < 45, `elevation ${v}`);
  assert.ok(Math.max(...a) > Math.min(...a) + 5, 'a crater rim should have a very uneven horizon');
});

test('horizon rays use the global map only after they leave the polar map', () => {
  let outsideCalls = 0;
  const outside = () => { outsideCalls += 1; return 0; };
  polar.computePolarHorizonProfile(grid, -90, 0, outside);
  assert.equal(outsideCalls, 0, 'rays of 300 km from the pole stay inside the 80 S circle (radius about 304 km)');
  polar.computePolarHorizonProfile(grid, -80.2, 40, outside);
  assert.ok(outsideCalls > 0, 'rays from near the boundary must continue on the global map');
});

test('standing on a tall peak the horizon is lower than from the floor of a deep crater', () => {
  const peak = cellCentreLatLon(1138, 1877), floor = cellCentreLatLon(1940, 1948); // Malapert massif (4927 m), Shackleton floor (-2785 m)
  const outside = () => 0;
  const fromPeak = polar.computePolarHorizonProfile(grid, peak.latDeg, peak.lonDeg, outside), fromFloor = polar.computePolarHorizonProfile(grid, floor.latDeg, floor.lonDeg, outside);
  const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;
  assert.ok(mean(fromPeak) < mean(fromFloor), `peak ${mean(fromPeak)} deg vs crater floor ${mean(fromFloor)} deg`);
});
