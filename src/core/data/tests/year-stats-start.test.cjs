// 一年统计的起点参数（statsStart）：默认不变；传了就从那一刻起算 8760 小时；超出星历范围的起点被拒绝。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installTypescriptLoader } = require('./load-typescript-for-tests.cjs');
installTypescriptLoader();
const { getPointConditions } = require('../point-conditions.ts');
const { statsStartSchema, resolveStatsStartMs } = require('../../../lib/shared/schemas.ts');

const POSITION = { latDeg: -89.71, lonDeg: 62.5 };
const TIME_MS = Date.UTC(2030, 5, 15, 12);
const HOUR_MS = 3_600_000;

test('no statsStart keeps the default period starting 2030-01-01', () => {
  const stats = getPointConditions(POSITION, TIME_MS).yearStats;
  assert.equal(stats.periodStartUtc, '2030-01-01T00:00:00.000Z');
  assert.equal(stats.periodEndUtc, '2031-01-01T00:00:00.000Z');
});

test('asking for the default start explicitly gives exactly the same answer', () => {
  const plain = getPointConditions(POSITION, TIME_MS);
  const explicit = getPointConditions(POSITION, TIME_MS, { statsStartMs: Date.UTC(2030, 0, 1) });
  assert.deepEqual(explicit, plain);
});

test('statsStart moves the whole period and the visible windows stay inside it', () => {
  const startMs = Date.UTC(2027, 2, 1, 6);
  const stats = getPointConditions(POSITION, TIME_MS, { statsStartMs: startMs }).yearStats;
  assert.equal(stats.periodStartUtc, new Date(startMs).toISOString());
  assert.equal(Date.parse(stats.periodEndUtc) - startMs, 8760 * HOUR_MS);
  for (const body of [stats.sun, stats.earth]) {
    assert.ok(body.visibleFraction >= 0 && body.visibleFraction <= 1);
    for (const w of body.visibleWindows) {
      assert.ok(Date.parse(w.startUtc) >= startMs && Date.parse(w.endUtc) <= Date.parse(stats.periodEndUtc));
    }
  }
});

test('a different start year gives a different result, and the provenance names the chosen start', () => {
  const base = getPointConditions(POSITION, TIME_MS);
  const moved = getPointConditions(POSITION, TIME_MS, { statsStartMs: Date.UTC(2038, 0, 1) });
  assert.notDeepEqual(moved.yearStats.sun, base.yearStats.sun);
  assert.match(moved.provenance.yearStats.note, /from 2038-01-01T00:00:00Z/);
  assert.match(moved.provenance.yearStats.note, /chosen by the caller/);
  assert.doesNotMatch(base.provenance.yearStats.note, /chosen by the caller/);
});

test('statsStart does not change anything outside yearStats', () => {
  const base = getPointConditions(POSITION, TIME_MS);
  const moved = getPointConditions(POSITION, TIME_MS, { statsStartMs: Date.UTC(2033, 6, 1) });
  assert.deepEqual({ ...moved, yearStats: null, provenance: null }, { ...base, yearStats: null, provenance: null });
});

test('statsStartSchema accepts a normal start and rejects starts the ephemeris cannot cover', () => {
  assert.equal(statsStartSchema.safeParse(undefined).success, true);
  assert.equal(statsStartSchema.safeParse('2027-03-01T00:00:00Z').success, true);
  assert.equal(statsStartSchema.safeParse('1999-12-31T00:00:00Z').success, false);
  assert.equal(statsStartSchema.safeParse('2099-06-01T00:00:00Z').success, false); // +8760 h would pass 2100
  assert.equal(statsStartSchema.safeParse('not a time').success, false);
  assert.equal(resolveStatsStartMs(undefined), undefined);
  assert.equal(resolveStatsStartMs('2027-03-01T00:00:00Z'), Date.UTC(2027, 2, 1));
});
