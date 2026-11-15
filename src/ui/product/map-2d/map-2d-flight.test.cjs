// 2D 平面图的自动飞行：点着陆点、搜索定位时，视野要平滑移过去（线上曾经是瞬间切过去、没有动画）。
// 直接加载 map-2d-flight.ts 的真实代码（用 typescript 在内存里转译），不依赖浏览器。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true };
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions }).outputText, filename);
};
const { startMapFlight, mapCameraOnFlight } = require(path.join(__dirname, "map-2d-flight.ts"));
const { clampCamera } = require(path.join(__dirname, "map-2d-camera.ts"));
const { MAX_FLIGHT_S } = require(path.join(__dirname, "..", "globe-3d", "camera-flight.ts"));

const SCREEN = { widthPx: 1440, heightPx: 900 };
const HERE = { centerU: 0.5, centerV: 0.5, mapWidthPx: 1800 }; // 整张图铺满屏幕（最小缩放）
const TARGET = { centerU: 0.6, centerV: 0.6, mapWidthPx: 14400 }; // 往东北方向、放大 8 倍
const NOW_MS = 20_000;

test("点一个地点：视野从现在的位置出发，中途在路上，飞完停在目标", () => {
  const flight = startMapFlight(TARGET, NOW_MS, null, HERE);
  const first = mapCameraOnFlight(flight, NOW_MS + 16, SCREEN);
  assert.equal(first.arrived, false, "第一帧不能就判定已到达（否则就是瞬移、没有动画）");
  assert.ok(Math.abs(first.camera.centerU - HERE.centerU) < 0.01, "第一帧视野还在起点附近");

  const midway = mapCameraOnFlight(flight, NOW_MS + 500, SCREEN);
  assert.equal(midway.arrived, false);
  assert.ok(midway.camera.centerU > HERE.centerU && midway.camera.centerU < TARGET.centerU, "中途经度在起点和终点之间");
  assert.ok(midway.camera.mapWidthPx > HERE.mapWidthPx && midway.camera.mapWidthPx < TARGET.mapWidthPx, "中途缩放在起点和终点之间");

  const end = mapCameraOnFlight(flight, NOW_MS + MAX_FLIGHT_S * 1000 + 50, SCREEN);
  assert.equal(end.arrived, true);
  const goal = clampCamera(TARGET, SCREEN);
  // 缩放是按对数走的，换算回来有 1e-15 级的浮点误差，肉眼不可见
  assert.ok(Math.abs(end.camera.centerU - goal.centerU) < 1e-9 && Math.abs(end.camera.centerV - goal.centerV) < 1e-9, "飞完要停在目标视野中心");
  assert.ok(Math.abs(end.camera.mapWidthPx / goal.mapWidthPx - 1) < 1e-9, "飞完要停在目标缩放");
});

test("飞行时长在 0.8 秒到 3D 最长飞行时间之间（照片等的就是这个时间）", () => {
  for (const target of [TARGET, { ...HERE, centerU: 0.501 }, { centerU: 3.5, centerV: 0.9, mapWidthPx: 20000 }]) {
    const { durationS } = startMapFlight(target, NOW_MS, null, HERE);
    assert.ok(durationS >= 0.8 && durationS <= MAX_FLIGHT_S, `时长 ${durationS}`);
  }
});

test("经度是循环的：从 0.98 去 0.02 走近的那一边（往东 0.04），不绕整个月球一圈", () => {
  const here = { centerU: 0.98, centerV: 0.5, mapWidthPx: 1800 };
  const target = { centerU: 0.02, centerV: 0.5, mapWidthPx: 1800 };
  const flight = startMapFlight(target, NOW_MS, null, here);
  const midway = mapCameraOnFlight(flight, NOW_MS + 400, SCREEN).camera;
  assert.ok(midway.centerU > 0.98 && midway.centerU < 1.02, `中途经度 ${midway.centerU}`);
  const end = mapCameraOnFlight(flight, NOW_MS + 3000, SCREEN).camera;
  assert.ok(Math.abs(end.centerU - 1.02) < 1e-9, "终点是同一个位置的另一份拷贝 1.02（= 0.02 + 1 圈）");
});

test("飞行过程中视野始终合法：不会露出上下黑边", () => {
  const flight = startMapFlight({ centerU: 0.5, centerV: 0.97, mapWidthPx: 30000 }, NOW_MS, null, HERE);
  for (let ms = 0; ms <= 2000; ms += 50) {
    const { camera } = mapCameraOnFlight(flight, NOW_MS + ms, SCREEN);
    assert.deepEqual(camera, clampCamera(camera, SCREEN), `${ms} 毫秒时视野越界`);
  }
});

test("飞到一半换目标：从当前位置和速度接着走，不跳回起点", () => {
  const first = startMapFlight(TARGET, NOW_MS, null, HERE);
  const at = mapCameraOnFlight(first, NOW_MS + 400, SCREEN).camera;
  const second = startMapFlight({ centerU: 0.2, centerV: 0.4, mapWidthPx: 5000 }, NOW_MS + 400, first, at);
  assert.equal(second.startS, (NOW_MS + 400) / 1000);
  const justAfter = mapCameraOnFlight(second, NOW_MS + 416, SCREEN).camera;
  assert.ok(Math.abs(justAfter.centerU - at.centerU) < 0.01, "换目标后的下一帧，视野还在刚才的位置附近");
  assert.ok(second.centerU.from.rate !== 0, "起点带着上一段飞行此刻的速度");
});
