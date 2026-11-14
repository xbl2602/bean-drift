// 运行：npm test。被测的 time-windows.ts 没有任何 import，Node 24 直接剥掉类型就能加载。
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../time-windows.ts');
const near = (a, b, tol, message) => assert.ok(Math.abs(a - b) <= tol, `${message}: ${a} vs ${b}`);

test('findVisibleIntervals finds window edges to well below the scan step', async () => {
  const { findVisibleIntervals } = await load();
  const visible = (t) => (t >= 105 && t < 200) || (t >= 350.5 && t < 380);
  const found = findVisibleIntervals(visible, 0, 500, 10);
  assert.equal(found.length, 2);
  near(found[0].startMs, 105, 0.1, 'first start');
  near(found[0].endMs, 200, 0.1, 'first end');
  near(found[1].startMs, 350.5, 0.1, 'second start');
  near(found[1].endMs, 380, 0.1, 'second end');
});

test('findVisibleIntervals counts windows cut by the start or the end of the range', async () => {
  const { findVisibleIntervals } = await load();
  const early = findVisibleIntervals((t) => t < 50, 0, 200, 10);
  assert.equal(early.length, 1);
  assert.equal(early[0].startMs, 0);
  near(early[0].endMs, 50, 0.1, 'cut at the start, ends at 50');

  const late = findVisibleIntervals((t) => t >= 150, 0, 200, 10);
  assert.equal(late.length, 1);
  near(late[0].startMs, 150, 0.1, 'starts at 150');
  assert.equal(late[0].endMs, 200); // 被范围末尾截断
});

test('findVisibleIntervals handles always and never visible', async () => {
  const { findVisibleIntervals } = await load();
  assert.deepEqual(findVisibleIntervals(() => true, 0, 95, 10), [{ startMs: 0, endMs: 95 }]);
  assert.deepEqual(findVisibleIntervals(() => false, 0, 95, 10), []);
});

test('intersectIntervals keeps only the time both are present', async () => {
  const { intersectIntervals } = await load();
  const a = [{ startMs: 0, endMs: 10 }, { startMs: 20, endMs: 30 }];
  const b = [{ startMs: 5, endMs: 25 }];
  assert.deepEqual(intersectIntervals(a, b), [{ startMs: 5, endMs: 10 }, { startMs: 20, endMs: 25 }]);
  assert.deepEqual(intersectIntervals(a, []), []);
  assert.deepEqual(intersectIntervals([{ startMs: 0, endMs: 10 }], [{ startMs: 10, endMs: 20 }]), []); // 只挨着，不算重叠
});

test('summarizeIntervals gives the visible share and the longest gap including both ends', async () => {
  const { summarizeIntervals } = await load();
  const windows = [{ startMs: 10, endMs: 20 }, { startMs: 30, endMs: 40 }];
  assert.deepEqual(summarizeIntervals(windows, 0, 50), { visibleFraction: 0.4, longestGapMs: 10 });
  assert.deepEqual(summarizeIntervals([], 0, 50), { visibleFraction: 0, longestGapMs: 50 });
  assert.deepEqual(summarizeIntervals([{ startMs: 0, endMs: 50 }], 0, 50), { visibleFraction: 1, longestGapMs: 0 });
  assert.deepEqual(summarizeIntervals([{ startMs: 40, endMs: 50 }], 0, 50), { visibleFraction: 0.2, longestGapMs: 40 });
});
