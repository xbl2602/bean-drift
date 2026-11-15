// 运行：npm test。被测的 site-search.ts 没有任何 import，Node 24 直接剥掉类型就能加载。
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../site-search.ts');

/**
 * 36 x 18 的小地图，每格 10°（ppd = 0.1）。第 r 行中心纬度 = 85 - 10r，第 c 列中心经度 = -175 + 10c。
 * 默认全 0；下面 4 个格子各有特点：
 *   A 南纬 -85，经 -175：坡 5.00°，同时可见 0.90，最长断电 20 h
 *   B 南纬 -85，经 -165：坡 3.00°，同时可见 0.98，最长断电 100 h（离 A 只有约 26 km）
 *   C 南纬 -75，经  25：坡 2.00°，同时可见 0.80
 *   D 北纬  85，经 -175：坡 40.00°，同时可见 0.99
 */
function makeMaps() {
  const cells = 36 * 18;
  const make = () => new Uint16Array(cells);
  const maps = {
    width: 36, height: 18, ppd: 0.1,
    heightRaw: new Int16Array(cells), heightUnitM: 0.5,
    slopeRaw: make(), slopeScale: 100,
    sunFractionRaw: make(), earthFractionRaw: make(), bothFractionRaw: make(), fractionScale: 10000,
    longestNoSunH: make(), longestNoEarthH: make(),
    meanNoSunRaw: make(), meanEarthWindowRaw: make(), meanScale: 4,
  };
  const at = (row, col) => row * 36 + col;
  const set = (row, col, v) => {
    const i = at(row, col);
    maps.slopeRaw[i] = v.slope; maps.bothFractionRaw[i] = v.both;
    maps.sunFractionRaw[i] = v.sun ?? v.both; maps.earthFractionRaw[i] = v.earth ?? v.both;
    maps.longestNoSunH[i] = v.noSunH ?? 0; maps.heightRaw[i] = v.height ?? 0;
  };
  set(17, 0, { slope: 500, both: 9000, sun: 9500, earth: 9300, noSunH: 20, height: -2000 });
  set(17, 1, { slope: 300, both: 9800, noSunH: 100 });
  set(16, 20, { slope: 200, both: 8000 });
  set(0, 0, { slope: 4000, both: 9900 });
  return maps;
}

const names = (result) => result.sites.map((s) => `${s.latDeg}/${s.lonDeg}`);
const A = '-85/-175', B = '-85/-165', C = '-75/25', D = '85/-175';

test('without criteria, ranks every cell by the chosen score', async () => {
  const { searchSites } = await load();
  const result = searchSites(makeMaps(), {}, 'bothVisibleFraction', 4, 0);
  assert.equal(result.matchedCells, 36 * 18);
  assert.equal(result.totalCells, 36 * 18);
  assert.deepEqual(names(result), [D, B, A, C]);
});

test('slope, fraction and outage criteria all have to hold', async () => {
  const { searchSites } = await load();
  const maps = makeMaps();
  assert.deepEqual(names(searchSites(maps, { maxSlopeDeg: 10 }, 'bothVisibleFraction', 3, 0)), [B, A, C]);
  assert.equal(searchSites(maps, { maxSlopeDeg: 10 }, 'bothVisibleFraction', 3, 0).matchedCells, 36 * 18 - 1); // 只有 D 太陡
  assert.deepEqual(names(searchSites(maps, { minBothVisibleFraction: 0.85, maxSlopeDeg: 10 }, 'bothVisibleFraction', 9, 0)), [B, A]);
  // B 最长断电 100 h，被 25 h 的上限挡掉
  assert.deepEqual(names(searchSites(maps, { minBothVisibleFraction: 0.5, maxLongestSunOutageH: 25 }, 'bothVisibleFraction', 9, 0)), [D, A, C]);
});

test('results closer than the minimum separation are dropped in favour of the better one', async () => {
  const { searchSites } = await load();
  const maps = makeMaps();
  const criteria = { minBothVisibleFraction: 0.85, maxSlopeDeg: 10 };
  assert.deepEqual(names(searchSites(maps, criteria, 'bothVisibleFraction', 9, 50)), [B]); // A 离 B 约 26 km
  assert.deepEqual(names(searchSites(maps, criteria, 'bothVisibleFraction', 9, 10)), [B, A]);
});

test('a latitude / longitude box limits the search area', async () => {
  const { searchSites } = await load();
  const maps = makeMaps();
  const south = searchSites(maps, { minBothVisibleFraction: 0.5, latMaxDeg: -80 }, 'bothVisibleFraction', 9, 0);
  assert.deepEqual(names(south), [B, A]);
  assert.equal(south.matchedCells, 2);
  const eastOnly = searchSites(maps, { minBothVisibleFraction: 0.5, lonMinDeg: 0 }, 'bothVisibleFraction', 9, 0);
  assert.deepEqual(names(eastOnly), [C]);
});

test('can rank by lowest slope instead', async () => {
  const { searchSites } = await load();
  assert.deepEqual(names(searchSites(makeMaps(), { minBothVisibleFraction: 0.5 }, 'lowestSlope', 9, 0)), [C, B, A, D]);
});

test('reports a cell in real units', async () => {
  const { searchSites } = await load();
  // 最长断电上限 25 h 把 B（100 h）挡掉，只剩 A
  const [site] = searchSites(makeMaps(), { minBothVisibleFraction: 0.85, maxSlopeDeg: 10, maxLongestSunOutageH: 25 }, 'sunVisibleFraction', 1, 0).sites;
  assert.deepEqual(site, {
    latDeg: -85, lonDeg: -175, heightM: -1000, slopeDeg: 5, // 高度 -2000 × 0.5 m
    sunVisibleFraction: 0.95, earthVisibleFraction: 0.93, bothVisibleFraction: 0.9,
    longestSunOutageH: 20, longestEarthOutageH: 0, meanSunOutageH: 0, meanEarthWindowH: 0,
  });
});

test('returns nothing (and matchedCells 0) when no cell qualifies', async () => {
  const { searchSites } = await load();
  const result = searchSites(makeMaps(), { minBothVisibleFraction: 0.999 }, 'bothVisibleFraction', 5, 0);
  assert.deepEqual(result, { matchedCells: 0, totalCells: 36 * 18, sites: [] });
});


test('steepest ranking respects inclusive slope range and existing filters', async () => {
  const { searchSites } = await load();
  const maps = makeMaps();
  assert.deepEqual(names(searchSites(maps, {}, 'highestSlope', 4, 0)), [D, A, B, C]);
  assert.deepEqual(names(searchSites(maps, { minSlopeDeg: 3, maxSlopeDeg: 5 }, 'highestSlope', 9, 0)), [A, B]);
  assert.deepEqual(names(searchSites(maps, { minSlopeDeg: 3, latMaxDeg: -80 }, 'highestSlope', 9, 50)), [A]);
  assert.equal(searchSites(maps, { minSlopeDeg: 41 }, 'highestSlope', 9, 0).matchedCells, 0);
  maps.slopeRaw[17 * 36 + 1] = 500;
  assert.deepEqual(names(searchSites(maps, { minSlopeDeg: 5, maxSlopeDeg: 5 }, 'highestSlope', 9, 0)), [B, A]);
});
