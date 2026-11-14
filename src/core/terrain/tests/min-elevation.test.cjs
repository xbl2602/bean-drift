// 运行：npm test。被测的 visibility.ts 没有任何 import，Node 24 直接剥掉类型就能加载。
const { test } = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../visibility.ts');

test('without a minimum elevation only the terrain counts, even when the terrain horizon is below zero', async () => {
  const { effectiveHorizonDeg } = await load();
  assert.equal(effectiveHorizonDeg(-0.87, undefined), -0.87); // 不传 = 不加要求（不能当成 0）
  assert.equal(effectiveHorizonDeg(3.5, undefined), 3.5);
});

test('a minimum elevation raises the horizon but never lowers it', async () => {
  const { effectiveHorizonDeg } = await load();
  assert.equal(effectiveHorizonDeg(-0.87, 0), 0);
  assert.equal(effectiveHorizonDeg(1, 5), 5);
  assert.equal(effectiveHorizonDeg(7, 5), 7); // 地形已经比 5° 高，仍以地形为准
});

test('a higher minimum elevation can only make a disk less visible', async () => {
  const { effectiveHorizonDeg, isDiskVisible } = await load();
  const earthElevationDeg = 3; // 地球圆心高度，视半径 1°
  assert.equal(isDiskVisible(earthElevationDeg, 1, effectiveHorizonDeg(0, undefined)), true);
  assert.equal(isDiskVisible(earthElevationDeg, 1, effectiveHorizonDeg(0, 2)), true); // 上缘 4° > 2°
  assert.equal(isDiskVisible(earthElevationDeg, 1, effectiveHorizonDeg(0, 5)), false); // 上缘 4° < 5°
});
