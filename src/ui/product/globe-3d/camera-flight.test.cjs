// 自动飞行镜头的起点：什么时候请求飞行，镜头都要真的飞起来、有动画（线上曾经点着陆点镜头完全不动）。
// 直接加载 camera-flight.ts 的真实代码（用 typescript 在内存里转译），不依赖浏览器。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true };
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions }).outputText, filename);
};
const THREE = require("three");
const { CameraMotionTracker, startCameraFlight, placeCameraOnFlight, MAX_FLIGHT_S } = require(path.join(__dirname, "camera-flight.ts"));

const START = new THREE.Vector3(0, 0, 5000); // 相机此刻在画面上的位置
const TARGET = new THREE.Vector3(3000, 2000, 1000); // 要飞去的位置
const NOW_MS = 20_000;

function flightFrom(tracker, current = null) {
  return startCameraFlight(TARGET, NOW_MS, current, tracker, START.clone());
}

test("全新页面（记录器是空的）：请求飞行会真的开始，从相机现在的位置起飞", () => {
  const flight = flightFrom(new CameraMotionTracker());
  assert.ok(flight, "必须返回一次飞行，而不是 null");
  assert.equal(flight.startS, NOW_MS / 1000);
  assert.ok(Math.abs(flight.phi.from.value - Math.PI / 2) < 1e-9, "起点的纬向角要等于相机现在的位置");
  assert.equal(flight.phi.from.rate, 0, "静止起飞：起始速度为 0");
  assert.ok(flight.durationS >= 1 && flight.durationS <= MAX_FLIGHT_S);
});

test("飞行有动画：中途镜头在路上，没到达；飞完正好停在目标", () => {
  const flight = flightFrom(new CameraMotionTracker());
  const camera = new THREE.PerspectiveCamera();
  const midway = placeCameraOnFlight(camera, flight, NOW_MS + 500);
  assert.equal(midway, false, "半秒时还没到达");
  const moved = camera.position.distanceTo(START);
  assert.ok(moved > 100 && camera.position.distanceTo(TARGET) > 100, `中途应该在起点和终点之间，离起点 ${moved.toFixed(0)}`);
  const arrived = placeCameraOnFlight(camera, flight, NOW_MS + MAX_FLIGHT_S * 1000 + 50);
  assert.equal(arrived, true);
  assert.ok(camera.position.distanceTo(TARGET) < 1, "飞完要停在目标位置");
});

test("镜头静止很久之后再请求飞行：从现在的位置慢慢起飞，不会第一帧就瞬移到目标", () => {
  const tracker = new CameraMotionTracker();
  // 三个五秒以前的旧样本（相当于上一次画面更新是 5 秒前）
  [14_000, 14_016, 14_033].forEach((t, i) => tracker.record(new THREE.Vector3(4000 + i, 3000, 1000), t));
  const flight = flightFrom(tracker);
  assert.equal(flight.startS, NOW_MS / 1000, "起点时刻必须是现在，不能是旧样本的时刻");
  const camera = new THREE.PerspectiveCamera();
  const arrivedAtFirstFrame = placeCameraOnFlight(camera, flight, NOW_MS + 16);
  assert.equal(arrivedAtFirstFrame, false, "第一帧不能就判定已到达");
  assert.ok(camera.position.distanceTo(START) < 50, "第一帧镜头应该还在起点附近");
});

test("用户刚拖完、镜头还在滑动时请求飞行：接着最后画出来的那一帧飞", () => {
  const tracker = new CameraMotionTracker();
  [19_900, 19_933, 19_966].forEach((t, i) => tracker.record(new THREE.Vector3(0, 10 * i, 5000), t));
  const flight = flightFrom(tracker);
  assert.ok(Math.abs(flight.startS - 19.966) < 1e-9, "起点时刻是最后一帧的时刻");
});

test("飞到一半又换目标：从当前飞行的速度和位置接着走", () => {
  const first = flightFrom(new CameraMotionTracker());
  const second = startCameraFlight(new THREE.Vector3(-3000, 1000, 2000), NOW_MS + 400, first, new CameraMotionTracker(), START.clone());
  assert.equal(second.startS, (NOW_MS + 400) / 1000);
  assert.ok(second.phi.from.rate !== 0 || second.theta.from.rate !== 0, "起点要带着上一段飞行此刻的速度");
});
