// 太阳能量估算：数值合理（对得上简单理论值）、可叠加、边界情况（永久阴影、极区水平板）、接口输入校验。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installTypescriptLoader } = require('../../../core/data/tests/load-typescript-for-tests.cjs');
installTypescriptLoader();
const { getSolarEnergyEstimate, SOLAR_CONSTANT_W_PER_M2 } = require('../../../core/data/solar-energy.ts');
const { solarEnergyInputSchema, getSolarEnergyForQuery } = require('../logic/get-solar-energy.ts');
const { GET } = require('../api/get-energy.ts');
const { TOOLS } = require('../../../core/registry.ts');

const START_MS = Date.UTC(2030, 0, 1);
const APOLLO_11 = { latDeg: 0.67416, lonDeg: 23.47314 };
const SYNODIC_MONTH_H = 708.7;

test('on the equator a flat panel gets about what a half-sine day of full sunlight gives', () => {
  // 白天约一半时间，太阳高度角近似 sin 形状：水平板一个朔望月的能量约 S * (2/pi) * (白天小时数 354.4) = 约 307 kWh/m2
  const theoryKWh = (SOLAR_CONSTANT_W_PER_M2 * (2 / Math.PI) * (SYNODIC_MONTH_H / 2)) / 1000;
  const e = getSolarEnergyEstimate(APOLLO_11, START_MS, SYNODIC_MONTH_H);
  const horizontalKWh = e.energyWhPerM2.horizontal / 1000;
  assert.ok(Math.abs(horizontalKWh - theoryKWh) / theoryKWh < 0.08, `${horizontalKWh} kWh/m2 vs theory ${theoryKWh}`);
  assert.ok(e.sunVisibleFraction > 0.45 && e.sunVisibleFraction < 0.55, `${e.sunVisibleFraction}`);
  // 太阳距离随季节变，常数 1360.8 的上下 7% 是合理范围：跟踪板的平均功率不会超过 1 倍常数太多
  assert.ok(e.meanPowerWPerM2.sunTracking < SOLAR_CONSTANT_W_PER_M2 * 0.6 && e.meanPowerWPerM2.sunTracking > SOLAR_CONSTANT_W_PER_M2 * 0.4);
});

test('a surface that follows the Sun never gets less than a vertical or a flat one', () => {
  for (const [latDeg, lonDeg] of [[0.67, 23.47], [-85.98, -1.67], [-89.71, 62.5], [45, -100]]) {
    const e = getSolarEnergyEstimate({ latDeg, lonDeg }, START_MS, 720);
    assert.ok(e.energyWhPerM2.sunTracking >= e.energyWhPerM2.verticalTracking - 0.2, `${latDeg}, ${lonDeg}`);
    assert.ok(e.energyWhPerM2.sunTracking >= e.energyWhPerM2.horizontal - 0.2, `${latDeg}, ${lonDeg}`);
    assert.ok(e.peakPowerWPerM2.sunTracking <= SOLAR_CONSTANT_W_PER_M2 * 1.06, 'peak beam power stays near the solar constant');
  }
});

test('at the poles a flat panel gets almost nothing while a vertical panel that turns to the Sun gets a lot', () => {
  const e = getSolarEnergyEstimate({ latDeg: -85.98, lonDeg: -1.67 }, START_MS, 8760); // Mons Malapert
  assert.ok(e.energyWhPerM2.verticalTracking > 10 * e.energyWhPerM2.horizontal, `${e.energyWhPerM2.verticalTracking} vs ${e.energyWhPerM2.horizontal}`);
  assert.ok(e.energyWhPerM2.verticalTracking > 0.8 * e.energyWhPerM2.sunTracking);
});

test('a permanently shadowed crater floor gets no sunlight and needs a battery for the whole period', () => {
  const e = getSolarEnergyEstimate({ latDeg: -89.67, lonDeg: 129.78 }, START_MS, 720); // Shackleton centre
  assert.deepEqual(e.energyWhPerM2, { sunTracking: 0, verticalTracking: 0, horizontal: 0 });
  assert.equal(e.sunVisibleFraction, 0);
  assert.equal(e.longestSunOutageH, 720);
  assert.equal(e.batteryWhPerWForLongestOutage, 720);
});

test('energy adds up: two halves of a period equal the whole period', () => {
  const whole = getSolarEnergyEstimate(APOLLO_11, START_MS, 720);
  const first = getSolarEnergyEstimate(APOLLO_11, START_MS, 360);
  const second = getSolarEnergyEstimate(APOLLO_11, START_MS + 360 * 3_600_000, 360);
  for (const surface of ['sunTracking', 'verticalTracking', 'horizontal']) {
    assert.ok(Math.abs(whole.energyWhPerM2[surface] - (first.energyWhPerM2[surface] + second.energyWhPerM2[surface])) < 0.5, surface);
  }
});

test('mean power is energy divided by the length of the period', () => {
  const e = getSolarEnergyEstimate(APOLLO_11, START_MS, 500);
  assert.ok(Math.abs(e.meanPowerWPerM2.sunTracking - e.energyWhPerM2.sunTracking / 500) < 0.1);
  assert.equal(e.durationH, 500);
  assert.equal(e.endUtc, new Date(START_MS + 500 * 3_600_000).toISOString());
});

test('a year uses coarser steps but stays close to a fine calculation', () => {
  const year = getSolarEnergyEstimate(APOLLO_11, START_MS, 8760);
  assert.equal(year.sampleStepMin, 30);
  const fine = getSolarEnergyEstimate(APOLLO_11, START_MS, 744);
  assert.equal(fine.sampleStepMin, 10);
  const yearMWh = year.energyWhPerM2.horizontal / 1e6;
  assert.ok(yearMWh > 3.3 && yearMWh < 4.1, `a flat panel on the equator gets about 3.7 MWh/m2 in a year, got ${yearMWh}`);
});

test('polar points use the 160 m data and say so in the provenance', () => {
  assert.match(getSolarEnergyEstimate({ latDeg: -89.71, lonDeg: 62.5 }, START_MS, 48).provenance.source, /LDEM_80S_40M/);
  assert.match(getSolarEnergyEstimate(APOLLO_11, START_MS, 48).provenance.source, /LDEM_64/);
});

test('input validation: defaults, ranges and the registered tool', () => {
  const ok = solarEnergyInputSchema.safeParse({ latDeg: -85, lonDeg: 10 });
  assert.equal(ok.success, true);
  assert.equal(ok.data.durationH, 720);
  for (const bad of [{ latDeg: 91, lonDeg: 0 }, { latDeg: 0, lonDeg: 0, durationH: 0 }, { latDeg: 0, lonDeg: 0, durationH: 9000 }, { latDeg: 0, lonDeg: 0, time: '1999-01-01T00:00:00Z' }]) {
    assert.equal(solarEnergyInputSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
  const tool = TOOLS.find((t) => t.name === 'get_solar_energy_estimate');
  assert.ok(tool && tool.access === 'read');
  assert.deepEqual(tool.run({ latDeg: 0.67, lonDeg: 23.47, durationH: 24, time: '2030-01-01T00:00:00Z' }), getSolarEnergyForQuery({ latDeg: 0.67, lonDeg: 23.47, durationH: 24, time: '2030-01-01T00:00:00Z' }));
});

test('GET /api/energy answers with JSON, and rejects bad input with a readable 400', async () => {
  const good = GET(new Request('http://localhost/api/energy?latDeg=-85.98&lonDeg=-1.67&time=2030-01-01T00:00:00Z&durationH=48'));
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.equal(typeof body.energyWhPerM2.sunTracking, 'number');
  assert.equal(body.durationH, 48);
  const bad = GET(new Request('http://localhost/api/energy?latDeg=abc&lonDeg=0'));
  assert.equal(bad.status, 400);
});
