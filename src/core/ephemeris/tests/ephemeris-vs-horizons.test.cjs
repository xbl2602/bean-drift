// 星历对照测试：把我们的太阳/地球方位角、高度角，和 NASA JPL Horizons 在同一时刻、同一月面观测点给出的值比。
// 参考值在 horizons-lunar-surface.json（8 个观测点 × 14 个时刻，2005-2090 年，由 pipeline/fetch-horizons-lunar-surface.py 抓取）。
// 比的是"两个方向之间的夹角"，不是分别比方位角和高度角：靠近天顶时方位角本来就不稳定，夹角不受影响。
// 门槛 0.02°：和接口 provenance 里宣称的精度一致。实测最大约 0.013°。以后改星历代码，这个测试能立刻报警。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installTypescriptLoader } = require('../../data/tests/load-typescript-for-tests.cjs');
installTypescriptLoader();
const { skyAtLatLon } = require('../ephemeris.ts');
const fixture = require('./horizons-lunar-surface.json');

const DEG = Math.PI / 180;
const MAX_ANGLE_ERROR_DEG = 0.02;

function unitVector(azimuthDeg, elevationDeg) {
  return [
    Math.cos(elevationDeg * DEG) * Math.sin(azimuthDeg * DEG),
    Math.cos(elevationDeg * DEG) * Math.cos(azimuthDeg * DEG),
    Math.sin(elevationDeg * DEG),
  ];
}

function angleBetweenDeg(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, Math.max(-1, dot))) / DEG;
}

test('the reference file covers many sites, dates and both bodies', () => {
  assert.ok(fixture.rows.length >= 100);
  assert.ok(new Set(fixture.rows.map((r) => r.site)).size >= 8);
  assert.ok(new Set(fixture.rows.map((r) => r.timeUtc.slice(0, 4))).size >= 10);
  assert.match(fixture.source, /JPL Horizons/);
});

test(`Sun and Earth directions agree with JPL Horizons within ${MAX_ANGLE_ERROR_DEG} degrees`, () => {
  const failures = [];
  for (const row of fixture.rows) {
    const ours = skyAtLatLon(Date.parse(row.timeUtc), row.latDeg, row.lonDeg);
    for (const body of ['sun', 'earth']) {
      const errorDeg = angleBetweenDeg(
        unitVector(row[body].azimuthDeg, row[body].elevationDeg),
        unitVector(ours[body].azimuthDeg, ours[body].elevationDeg),
      );
      if (!(errorDeg <= MAX_ANGLE_ERROR_DEG)) failures.push(`${row.site} ${row.timeUtc} ${body}: ${errorDeg.toFixed(4)} deg`);
    }
  }
  assert.deepEqual(failures, []);
});
