// 基线测试用的"探测点"和"怎么算出它们的完整输出"。录制基线的脚本和基线测试都用这一份，保证两边算法一致。
// 探测点故意覆盖各种边界：两极、80°S 两侧、背面、经度 ±180° 与绕回、赤道、阿波罗 11 号、南极几个著名地点。
const { installTypescriptLoader } = require('./load-typescript-for-tests.cjs');
installTypescriptLoader();
const { getPointConditions, getPointAcrossTimes, getPointTimeline, findSites } = require('../index.ts');

/** 极区数据（80°S 以南，含 80°S）负责的探测点：它们的基线单独存放（point-output-polar.baseline.json）。 */
const POLAR_COVERAGE_NORTH_LATDEG = -80;
const isPolarProbe = (probe) => probe.position.latDeg <= POLAR_COVERAGE_NORTH_LATDEG;

/** 固定的查询时刻（UTC）：基线必须不随"现在"变化。 */
const EVALUATED_AT_MS = Date.UTC(2030, 5, 15, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

const PROBES = [
  ['north-pole', 90, 0],
  ['south-pole', -90, 0],
  ['shackleton-rim', -89.9, 129.8],
  ['haworth', -87.5, -5],
  ['malapert', -85.9, 12.9],
  ['south-80-just-inside', -80.01, 40],
  ['south-80-exact', -80, 40],
  ['south-80-just-outside', -79.99, 40],
  ['apollo-11', 0.67416, 23.47314],
  ['equator-near-side-centre', 0, 0],
  ['far-side-centre', 0, 180],
  ['far-side-centre-written-as-minus-180', 0, -180],
  ['longitude-190-wraps-to-minus-170', 10, 190],
  ['mid-north', 45, -100],
].map(([name, latDeg, lonDeg]) => ({ name, position: { latDeg, lonDeg } }));

const WITH_EARTH_FLOOR = new Set(['south-pole', 'shackleton-rim', 'malapert', 'south-80-exact', 'far-side-centre']);
const WITH_ACROSS_TIMES = new Set(['north-pole', 'shackleton-rim', 'apollo-11', 'far-side-centre']);
const WITH_TIMELINE = new Set(['south-pole', 'shackleton-rim', 'malapert', 'apollo-11', 'far-side-centre', 'south-80-exact']);

const SITE_SEARCHES = [
  { name: 'south-polar-gentle-slopes', criteria: { maxSlopeDeg: 10, latMaxDeg: -80 }, options: { rankBy: 'bothVisibleFraction', limit: 5, minSeparationKm: 50 } },
  // 全月"两者同时可见"的最大值约 0.578，所以门槛取 0.5：要能搜出东西，空结果起不到保护作用
  { name: 'sun-and-earth-both-visible-half-the-year', criteria: { minBothVisibleFraction: 0.5 }, options: { rankBy: 'bothVisibleFraction', limit: 5, minSeparationKm: 200 } },
  { name: 'flattest-near-equator', criteria: { latMinDeg: -10, latMaxDeg: 10 }, options: { rankBy: 'lowestSlope', limit: 5, minSeparationKm: 100 } },
];

/** 去掉 undefined、NaN 变 null：和写进 JSON 文件再读回来的结果一致。 */
const plain = (value) => JSON.parse(JSON.stringify(value));

function computeProbeOutputs() {
  const conditions = {}, conditionsWithEarthFloor = {}, acrossTimes = {}, timelines = {}, siteSearches = {};
  for (const { name, position } of PROBES) {
    conditions[name] = plain(getPointConditions(position, EVALUATED_AT_MS));
    if (WITH_EARTH_FLOOR.has(name)) conditionsWithEarthFloor[name] = plain(getPointConditions(position, EVALUATED_AT_MS, { minEarthElevationDeg: 5 }));
    if (WITH_ACROSS_TIMES.has(name)) acrossTimes[name] = plain(getPointAcrossTimes(position, [EVALUATED_AT_MS, EVALUATED_AT_MS + 7 * DAY_MS, EVALUATED_AT_MS + 100 * DAY_MS]));
    if (WITH_TIMELINE.has(name)) timelines[name] = plain(getPointTimeline(position, EVALUATED_AT_MS, 24, 60));
  }
  for (const { name, criteria, options } of SITE_SEARCHES) siteSearches[name] = plain(findSites(criteria, options));
  return { conditions, conditionsWithEarthFloor, acrossTimes, timelines, siteSearches };
}

module.exports = { computeProbeOutputs, EVALUATED_AT_MS, PROBES, isPolarProbe };
