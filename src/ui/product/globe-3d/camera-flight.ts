// 3D 球上的"自动飞行"镜头：选中一个着陆点、搜索一个地点时，相机从当前位置飞过去。
//
// 要求：位置、速度、加速度全程连续（二阶导连续，C2），不能出现突然的加速。做法：
// - 用相机绕月的球坐标（极角 phi、方位角 theta、距离取对数 s = ln r）描述位置。OrbitControls 也用同一套坐标，
//   画面始终"北朝上"，所以镜头朝向也跟着平滑变化（不会在极点附近突然打转）。
// - 每个坐标走一条五次 Hermite 曲线（motion/smooth-value.ts）：起点的值、速度、加速度 = 相机此刻真实的值、速度、加速度；
//   终点的速度、加速度都是 0。所以起飞、降落都没有加速度跳变；飞到一半换目标，也是接着当前的速度和加速度继续。
// - 相机还在惯性滑动（用户刚拖完）时起飞，用最近三帧的位置估算当时的速度和加速度。
import * as THREE from "three";
import { quinticAt, type AxisState } from "../motion/smooth-value";

interface Axis { from: AxisState; to: number }

export interface CameraFlight {
  phi: Axis;
  theta: Axis;
  logRadius: Axis;
  startS: number;
  durationS: number;
}

interface PoseSample { tS: number; phi: number; theta: number; logRadius: number }

const SAFE_PHI = 1e-4;
const MAX_SAMPLE_GAP_S = 0.1;
const MIN_FLIGHT_S = 1;
/** 一次自动飞行最长这么久。别的界面要"等镜头飞完再干重活"时用它算等多久（见 panels/site-photo.tsx）。 */
export const MAX_FLIGHT_S = 1.9;

/** 记录最近三帧的相机位置，用来估算惯性滑动时的速度和加速度。 */
export class CameraMotionTracker {
  private samples: PoseSample[] = [];

  record(position: THREE.Vector3, nowMs: number) {
    const pose = poseOf(position, nowMs / 1000);
    const last = this.samples[this.samples.length - 1];
    if (last) pose.theta = last.theta + wrapAngle(pose.theta - last.theta); // 方位角展开，不在 ±π 处跳
    this.samples.push(pose);
    if (this.samples.length > 3) this.samples.shift();
  }

  /** 最后一帧的时刻和各坐标状态；帧之间隔太久（比如切到后台）就当作静止。 */
  latest(): { tS: number; phi: AxisState; theta: AxisState; logRadius: AxisState } | null {
    const n = this.samples.length;
    if (n === 0) return null;
    const [a, b, c] = n === 3 ? this.samples : [this.samples[n - 1], this.samples[n - 1], this.samples[n - 1]];
    const moving = n === 3 && c.tS - b.tS > 1e-4 && b.tS - a.tS > 1e-4 && c.tS - a.tS < 2 * MAX_SAMPLE_GAP_S;
    const axis = (key: "phi" | "theta" | "logRadius"): AxisState => moving
      ? quadraticAtEnd([a.tS, b.tS, c.tS], [a[key], b[key], c[key]])
      : { value: c[key], rate: 0, accel: 0 };
    return { tS: c.tS, phi: axis("phi"), theta: axis("theta"), logRadius: axis("logRadius") };
  }
}

/** 从此刻的运动状态出发，飞到 target（相机的目标位置）。current 为空表示当前没有在飞。 */
export function startCameraFlight(target: THREE.Vector3, nowMs: number, current: CameraFlight | null, tracker: CameraMotionTracker): CameraFlight | null {
  let startS = nowMs / 1000;
  let state = current ? flightStateAt(current, startS) : null;
  if (!state) {
    const observed = tracker.latest();
    if (!observed) return null;
    // 从最后画出来的那一帧接着飞，起点和画面上的位置完全一致
    startS = observed.tS;
    state = observed;
  }
  const goal = poseOf(target, startS);
  const thetaTo = state.theta.value + wrapAngle(goal.theta - state.theta.value);
  const angularDistance = Math.hypot(goal.phi - state.phi.value, Math.sin(goal.phi) * (thetaTo - state.theta.value));
  const zoomDistance = Math.abs(goal.logRadius - state.logRadius.value);
  return {
    phi: { from: state.phi, to: goal.phi },
    theta: { from: state.theta, to: thetaTo },
    logRadius: { from: state.logRadius, to: goal.logRadius },
    startS,
    durationS: THREE.MathUtils.clamp(0.9 + 0.35 * angularDistance + 0.25 * zoomDistance, MIN_FLIGHT_S, MAX_FLIGHT_S),
  };
}

/** 把相机放到飞行路线上 nowMs 时刻的位置，镜头对准月心（和 OrbitControls 的朝向规则一样）。返回 true 表示已经到达。 */
export function placeCameraOnFlight(camera: THREE.Camera, flight: CameraFlight, nowMs: number): boolean {
  const tS = nowMs / 1000;
  const phi = THREE.MathUtils.clamp(axisAt(flight.phi, tS - flight.startS, flight.durationS).value, SAFE_PHI, Math.PI - SAFE_PHI);
  const theta = axisAt(flight.theta, tS - flight.startS, flight.durationS).value;
  const radius = Math.exp(axisAt(flight.logRadius, tS - flight.startS, flight.durationS).value);
  camera.position.setFromSphericalCoords(radius, phi, theta);
  camera.lookAt(0, 0, 0);
  return tS - flight.startS >= flight.durationS;
}

function flightStateAt(flight: CameraFlight, tS: number) {
  const elapsed = tS - flight.startS;
  return {
    phi: axisAt(flight.phi, elapsed, flight.durationS),
    theta: axisAt(flight.theta, elapsed, flight.durationS),
    logRadius: axisAt(flight.logRadius, elapsed, flight.durationS),
  };
}

function axisAt(axis: Axis, elapsedS: number, durationS: number): AxisState {
  return quinticAt(axis.from, axis.to, elapsedS, durationS);
}

/** 过三个点的二次曲线在最后一个点处的值、一阶导、二阶导（时间间隔可以不相等）。 */
function quadraticAtEnd([t0, t1, t2]: number[], [p0, p1, p2]: number[]): AxisState {
  const d0 = (t0 - t1) * (t0 - t2), d1 = (t1 - t0) * (t1 - t2), d2 = (t2 - t0) * (t2 - t1);
  return {
    value: p2,
    rate: (p0 * (t2 - t1)) / d0 + (p1 * (t2 - t0)) / d1 + (p2 * (2 * t2 - t0 - t1)) / d2,
    accel: 2 * (p0 / d0 + p1 / d1 + p2 / d2),
  };
}

function poseOf(position: THREE.Vector3, tS: number): PoseSample {
  const spherical = new THREE.Spherical().setFromVector3(position);
  return { tS, phi: spherical.phi, theta: spherical.theta, logRadius: Math.log(spherical.radius) };
}

function wrapAngle(rad: number): number {
  return rad - 2 * Math.PI * Math.round(rad / (2 * Math.PI));
}
