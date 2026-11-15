// 二阶导连续（C2）的动画：位置、速度、加速度全程都不跳变，没有突然的加速或急停。
// 3D 镜头飞行（globe-3d/camera-flight.ts）和教程的高亮框、卡片、按钮放大都用这一份。
//
// 每段动画是一条五次 Hermite 曲线：起点的值/速度/加速度 = 此刻真实的状态，终点速度和加速度都是 0。
// 动画进行中换目标，就从当前的速度和加速度接着走，所以连续点"下一步"也是顺滑的。

/** 一个数值此刻的状态：值、速度（每秒）、加速度（每秒²）。 */
export interface AxisState { value: number; rate: number; accel: number }

/**
 * p(τ) = p0 + Δ·S(τ) + v0·T·H1(τ) + a0·T²·H2(τ)，τ = t/T。
 * S 是 smootherstep（两端一、二阶导都为 0）；H1、H2 只在起点贡献速度和加速度，到终点时值和一、二阶导都为 0。
 */
export function quinticAt(from: AxisState, to: number, elapsedS: number, durationS: number): AxisState {
  const T = durationS;
  if (T <= 0 || elapsedS >= T) return { value: to, rate: 0, accel: 0 };
  const tau = Math.max(elapsedS, 0) / T;
  const { value: p0, rate: v0, accel: a0 } = from;
  const delta = to - p0;
  const t2 = tau * tau, t3 = t2 * tau, t4 = t3 * tau, t5 = t4 * tau;
  const S = 10 * t3 - 15 * t4 + 6 * t5;
  const dS = 30 * t2 - 60 * t3 + 30 * t4;
  const ddS = 60 * tau - 180 * t2 + 120 * t3;
  const H1 = tau - 6 * t3 + 8 * t4 - 3 * t5;
  const dH1 = 1 - 18 * t2 + 32 * t3 - 15 * t4;
  const ddH1 = -36 * tau + 96 * t2 - 60 * t3;
  const H2 = 0.5 * t2 - 1.5 * t3 + 1.5 * t4 - 0.5 * t5;
  const dH2 = tau - 4.5 * t2 + 6 * t3 - 2.5 * t4;
  const ddH2 = 1 - 9 * tau + 18 * t2 - 10 * t3;
  return {
    value: p0 + delta * S + v0 * T * H1 + a0 * T * T * H2,
    rate: (delta * dS + v0 * T * dH1 + a0 * T * T * dH2) / T,
    accel: (delta * ddS + v0 * T * ddH1 + a0 * T * T * ddH2) / (T * T),
  };
}

/** 一个会平滑追随目标的数。 */
export class SmoothValue {
  private from: AxisState;
  private to: number;
  private startMs = 0;
  private durationMs = 0;

  constructor(value: number) {
    this.from = { value, rate: 0, accel: 0 };
    this.to = value;
  }

  at(nowMs: number): AxisState {
    return quinticAt(this.from, this.to, (nowMs - this.startMs) / 1000, this.durationMs / 1000);
  }

  get target() { return this.to; }

  /** 从 nowMs 时刻的状态出发，用 durationMs 走到新目标。 */
  retarget(to: number, nowMs: number, durationMs: number) {
    if (to === this.to && this.settled(nowMs)) return;
    this.from = this.at(nowMs);
    this.to = to;
    this.startMs = nowMs;
    this.durationMs = durationMs;
  }

  /** 直接跳到某个值（第一次定位、或用户要求减少动画时）。 */
  jump(value: number) {
    this.from = { value, rate: 0, accel: 0 };
    this.to = value;
    this.durationMs = 0;
  }

  settled(nowMs: number) {
    return nowMs - this.startMs >= this.durationMs;
  }
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
