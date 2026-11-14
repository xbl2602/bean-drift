// 地形遮挡下的可见性：纯函数，不依赖 Node、HTTP、文件。
// "可见"的定义（TODO Q1 已定，见 docs/decisions/）：太阳或地球圆盘的上缘高于地形地平线，就算可见（圆盘露出任何一部分）。
// 这与 NASA LOLA 的平均可见性产品同口径，便于对照；对只关心 DSN 链路的场景略偏乐观。

/**
 * 地平线剖面在某个方位的遮挡仰角（度）。
 * profileDeg[k] 是方位 k * 360 / n 的仰角（n = 数组长度，正北 0°，向东增加），方位之间线性插值，绕回正北。
 */
export function horizonElevationDeg(profileDeg: ArrayLike<number>, azimuthDeg: number): number {
  const n = profileDeg.length;
  const f = ((((azimuthDeg % 360) + 360) % 360) / 360) * n;
  const k = Math.floor(f);
  const t = f - k;
  return profileDeg[k % n] * (1 - t) + profileDeg[(k + 1) % n] * t;
}

/**
 * 圆盘露在地平线之上的面积比例，0~1。
 * 圆盘圆心高度角 elevationDeg、视半径 radiusDeg；地平线在这个方位上近似成一条水平线 horizonDeg。
 * 比例为 0 当且仅当上缘不高于地平线（elevationDeg + radiusDeg <= horizonDeg），与"可见"的定义一致。
 */
export function diskVisibleFraction(elevationDeg: number, radiusDeg: number, horizonDeg: number): number {
  const d = (elevationDeg - horizonDeg) / radiusDeg; // 圆心到地平线的距离，以半径为单位，向上为正
  if (d >= 1) return 1;
  if (d <= -1) return 0;
  // 圆被一条距圆心 d 的弦切开，弦下方的弓形面积 = acos(d) - d * sqrt(1 - d^2)（单位圆），整圆面积 = pi
  return 1 - (Math.acos(d) - d * Math.sqrt(1 - d * d)) / Math.PI;
}

/** 圆盘上缘高于地平线（= 露出任何一部分）。 */
export function isDiskVisible(elevationDeg: number, radiusDeg: number, horizonDeg: number): boolean {
  return elevationDeg + radiusDeg > horizonDeg;
}

export interface VisibilityRuns {
  /** 可见的时间占比，0~1。 */
  visibleFraction: number;
  /** 最长一次连续不可见，小时（从未可见 = 整个统计期）。 */
  longestOutageH: number;
  /** 所有连续不可见时段的平均时长，小时（从未不可见 = 0）。 */
  meanOutageH: number;
  /** 所有连续可见时段的平均时长，小时（从未可见 = 0）。 */
  meanVisibleWindowH: number;
  /** 连续可见时段，[startStep, endStep) 以采样序号计。 */
  visibleWindows: { startStep: number; endStep: number }[];
}

/**
 * 把逐步的可见/不可见序列整理成连续时段统计。
 * 被统计期开头或结尾截断的时段，按截断后的长度计入（与 pipeline/stats-worker.mjs 的口径完全一致）。
 */
export function summarizeVisibilityRuns(visible: ArrayLike<boolean | number>, stepH: number): VisibilityRuns {
  const n = visible.length;
  let visibleSteps = 0;
  let outageSteps = 0;
  let outageCount = 0;
  let longestOutageSteps = 0;
  let windowSteps = 0;
  const visibleWindows: { startStep: number; endStep: number }[] = [];

  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    const runEnded = i === n || Boolean(visible[i]) !== Boolean(visible[runStart]);
    if (!runEnded) continue;
    const length = i - runStart;
    if (Boolean(visible[runStart])) {
      visibleSteps += length;
      windowSteps += length;
      visibleWindows.push({ startStep: runStart, endStep: i });
    } else {
      outageSteps += length;
      outageCount += 1;
      if (length > longestOutageSteps) longestOutageSteps = length;
    }
    runStart = i;
  }

  return {
    visibleFraction: n === 0 ? 0 : visibleSteps / n,
    longestOutageH: longestOutageSteps * stepH,
    meanOutageH: outageCount === 0 ? 0 : (outageSteps / outageCount) * stepH,
    meanVisibleWindowH: visibleWindows.length === 0 ? 0 : (windowSteps / visibleWindows.length) * stepH,
    visibleWindows,
  };
}
