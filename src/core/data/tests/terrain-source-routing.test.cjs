// 路由测试：每个位置读到的是"该读的那份数据"。
// 现在线上只有全月一份数据，所以用一个假的"南极高精度"数据源（负责纬度 ≤ -80°）来证明：
// 边界两侧、两极、背面、经度 ±180° 都被送到正确的数据源，且没被选中的数据源一次都没有被读取。
// 以后真的接入南极数据，规则放在 TERRAIN_SOURCES 里，这里的边界用例照样适用。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installTypescriptLoader } = require('./load-typescript-for-tests.cjs');
installTypescriptLoader();
const { chooseTerrainSource, readPointTerrainData, readPointHorizonProfile, TERRAIN_SOURCES } = require('../terrain-source-routing.ts');
const precomputedMaps = require('../precomputed-maps.ts');

/** 假数据源：记录自己被读了几次，返回能一眼认出来的数。 */
function fakeSource(id, covers) {
  const calls = { terrain: 0, horizon: 0 };
  const source = {
    id,
    covers,
    readTerrain: () => { calls.terrain += 1; return { heightM: 1, slopeDeg: 2, aspectDeg: null, resolutionM: 3 }; },
    readHorizonProfile: () => { calls.horizon += 1; return [0, 1, 2, 3]; },
    terrainProvenance: (azimuths) => ({ status: 'ok', source: id, note: `${azimuths} azimuths` }),
  };
  return { source, calls };
}

const POLAR_SOUTH_OF_80 = (latDeg) => latDeg <= -80;

test('with only the global source in the list, every kind of place is routed to it', () => {
  assert.deepEqual(TERRAIN_SOURCES.map((source) => source.id), ['global-0.25deg']);
  for (const [latDeg, lonDeg] of [[90, 0], [-90, 0], [-89.9, 129.8], [-80, 40], [-79.99, 40], [0, 180], [0, -179.99], [45, -100]]) {
    assert.equal(chooseTerrainSource(latDeg, lonDeg).id, 'global-0.25deg', `${latDeg}, ${lonDeg}`);
  }
});

test('a regional source wins inside its area and the global source takes everything else', () => {
  const polar = fakeSource('south-polar', POLAR_SOUTH_OF_80).source;
  const global = fakeSource('global', () => true).source;
  const sources = [polar, global];
  const expectations = [
    ['south pole', -90, 0, 'south-polar'],
    ['Shackleton rim', -89.9, 129.8, 'south-polar'],
    ['just inside the boundary', -80.01, 40, 'south-polar'],
    ['exactly on the boundary (boundary belongs to the regional source)', -80, 40, 'south-polar'],
    ['just outside the boundary', -79.99, 40, 'global'],
    ['south polar area at longitude 180', -85, 180, 'south-polar'],
    ['south polar area at longitude -179.99', -85, -179.99, 'south-polar'],
    ['equator, near side', 0, 0, 'global'],
    ['far side', 0, 180, 'global'],
    ['north pole', 90, 0, 'global'],
  ];
  for (const [label, latDeg, lonDeg, expectedId] of expectations) assert.equal(chooseTerrainSource(latDeg, lonDeg, sources).id, expectedId, label);
});

test('only the chosen source is read; the others are never touched', () => {
  const polar = fakeSource('south-polar', POLAR_SOUTH_OF_80);
  const global = fakeSource('global', () => true);
  const sources = [polar.source, global.source];

  const inPolar = readPointTerrainData(-88, 10, sources);
  assert.equal(inPolar.source.id, 'south-polar');
  assert.deepEqual([polar.calls.terrain, polar.calls.horizon, global.calls.terrain, global.calls.horizon], [1, 1, 0, 0]);

  const outside = readPointTerrainData(10, 10, sources);
  assert.equal(outside.source.id, 'global');
  assert.deepEqual([polar.calls.terrain, polar.calls.horizon, global.calls.terrain, global.calls.horizon], [1, 1, 1, 1]);
});

test('asking only for the horizon reads only the horizon, from the chosen source', () => {
  const polar = fakeSource('south-polar', POLAR_SOUTH_OF_80);
  const global = fakeSource('global', () => true);
  assert.deepEqual(readPointHorizonProfile(-88, 10, [polar.source, global.source]), [0, 1, 2, 3]);
  assert.deepEqual([polar.calls.terrain, polar.calls.horizon, global.calls.terrain, global.calls.horizon], [0, 1, 0, 0]);
});

test('the first covering source wins when several cover the same place', () => {
  const first = fakeSource('first', () => true).source;
  const second = fakeSource('second', () => true).source;
  assert.equal(chooseTerrainSource(0, 0, [first, second]).id, 'first');
});

test('when no source covers a place it throws instead of quietly using something else', () => {
  const polar = fakeSource('south-polar', POLAR_SOUTH_OF_80).source;
  assert.throws(() => chooseTerrainSource(10, 10, [polar]), /no terrain data source covers/);
  assert.throws(() => readPointTerrainData(10, 10, [polar]), /no terrain data source covers/);
  assert.throws(() => chooseTerrainSource(10, 10, []), /no terrain data source covers/);
});

test('the real global source returns exactly what the low-level map readers return', () => {
  const maps = precomputedMaps.openPrecomputedMaps();
  for (const [latDeg, lonDeg] of [[0.67416, 23.47314], [-89.9, 129.8], [0, 180], [60, -170]]) {
    const data = readPointTerrainData(latDeg, lonDeg);
    assert.equal(data.source.id, 'global-0.25deg');
    assert.deepStrictEqual(data.terrain, precomputedMaps.readTerrainAt(maps, latDeg, lonDeg));
    assert.deepStrictEqual(data.horizonProfileDeg, precomputedMaps.readHorizonProfileAt(maps, latDeg, lonDeg));
    assert.deepStrictEqual(readPointHorizonProfile(latDeg, lonDeg), data.horizonProfileDeg);
  }
});
