// 运行：npm run test:core
import assert from "node:assert/strict";
import { test } from "node:test";
import { diskVisibleFraction, horizonElevationDeg, isDiskVisible, summarizeVisibilityRuns } from "../visibility.ts";

test("horizonElevationDeg interpolates between azimuths and wraps around north", () => {
  const profile = [0, 10, 20, 30]; // 方位 0°, 90°, 180°, 270°
  assert.equal(horizonElevationDeg(profile, 0), 0);
  assert.equal(horizonElevationDeg(profile, 45), 5);
  assert.equal(horizonElevationDeg(profile, 180), 20);
  assert.equal(horizonElevationDeg(profile, 315), 15); // 30 与（绕回的）0 的中点
  assert.equal(horizonElevationDeg(profile, 360), 0);
  assert.equal(horizonElevationDeg(profile, -90), 30);
});

/** 数值积分：半径 1 的圆，圆心高度 d，在水平线 y = 0 上方的面积占比。 */
function bruteForceFraction(d: number): number {
  const steps = 200000;
  let above = 0;
  for (let i = 0; i < steps; i++) {
    const x = -1 + ((i + 0.5) * 2) / steps;
    const half = Math.sqrt(Math.max(0, 1 - x * x)); // 这一列圆的纵向范围 d-half .. d+half
    above += Math.max(0, d + half - Math.max(0, d - half)); // 该列在 y > 0 的部分的长度
  }
  return (above * (2 / steps)) / Math.PI;
}

test("diskVisibleFraction matches numerical integration", () => {
  for (const d of [-0.9, -0.5, -0.1, 0, 0.1, 0.5, 0.9]) {
    assert.ok(Math.abs(diskVisibleFraction(d, 1, 0) - bruteForceFraction(d)) < 1e-4, `d = ${d}`);
  }
});

test("diskVisibleFraction edge cases and scaling", () => {
  assert.equal(diskVisibleFraction(0, 0.27, 0), 0.5); // 圆心正好在地平线上
  assert.equal(diskVisibleFraction(5, 0.27, 0), 1);
  assert.equal(diskVisibleFraction(-5, 0.27, 0), 0);
  assert.equal(diskVisibleFraction(-0.27, 0.27, 0), 0); // 上缘正好贴着地平线：不可见
  assert.equal(diskVisibleFraction(2.27, 0.27, 2), diskVisibleFraction(0.27, 0.27, 0)); // 只和相对高度有关
});

test("a disk is visible exactly when some fraction of it is above the horizon", () => {
  for (const e of [-1.5, -0.5, -0.27, -0.2, 0, 0.2, 1]) {
    assert.equal(isDiskVisible(e, 0.27, 0), diskVisibleFraction(e, 0.27, 0) > 0, `elevation ${e}`);
  }
});

test("summarizeVisibilityRuns counts runs inside the period", () => {
  const r = summarizeVisibilityRuns([1, 1, 0, 0, 0, 1, 0], 1);
  assert.equal(r.visibleFraction, 3 / 7);
  assert.equal(r.longestOutageH, 3);
  assert.equal(r.meanOutageH, 2); // (3 + 1) / 2
  assert.equal(r.meanVisibleWindowH, 1.5); // (2 + 1) / 2
  assert.deepEqual(r.visibleWindows, [
    { startStep: 0, endStep: 2 },
    { startStep: 5, endStep: 6 },
  ]);
});

test("summarizeVisibilityRuns handles never visible, always visible and the step length", () => {
  const dark = summarizeVisibilityRuns([0, 0, 0], 1);
  assert.deepEqual([dark.visibleFraction, dark.longestOutageH, dark.meanOutageH, dark.meanVisibleWindowH, dark.visibleWindows.length], [0, 3, 3, 0, 0]);
  const lit = summarizeVisibilityRuns([true, true, true], 1);
  assert.deepEqual([lit.visibleFraction, lit.longestOutageH, lit.meanOutageH, lit.meanVisibleWindowH, lit.visibleWindows.length], [1, 0, 0, 3, 1]);
  assert.equal(summarizeVisibilityRuns([0, 1, 1, 0], 2).longestOutageH, 2); // 每步 2 小时
});
