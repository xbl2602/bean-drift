// 任务模拟（纯计算，不碰网络和界面）：按 15 分钟一步，从着陆一直算到任务结束。
// 输入：任务配置 + 这段时间里太阳 / 地球"看得见"的时间段（来自 /api/timeline，含真实地形遮挡）。
// 每一步：有阳光就发电（太阳能板）+ 核电源一直发电；电够就工作，电池低于保留电量又没阳光就休眠保命；
// 电池用光还缺电 = 失电（无人任务冻坏 / 载人任务生命保障失效），任务失败。能看到地球时把攒下的数据传回去。
// 简化（界面上会写明）：太阳能板始终对准太阳、没有温度对效率的影响、电池充电效率固定 90%、没有中继卫星。
import type { Interval, MissionWindows } from "./fetch-mission-windows";
import { operatingLoadW, survivalLoadW, type MissionConfig } from "./mission-presets";

const HOUR_MS = 3_600_000;
const STEP_H = 0.25;
const CHARGE_EFFICIENCY = 0.9;
/** 电池低于这个比例、又没有阳光时转入休眠。 */
const RESERVE_FRACTION = 0.25;
/** 休眠后要充到这个比例（或者发电够工作）才醒来，免得在 25% 附近每 15 分钟醒一次睡一次。 */
const WAKE_FRACTION = 0.3;
const LOW_BATTERY_FRACTION = 0.2;
/** 图表最多画这么多个点。 */
const MAX_SAMPLES = 480;
const MAX_EVENTS = 60;

export type MissionOutcome = "success" | "partial" | "failed";
export type MissionMode = "operating" | "hibernating" | "failed";
export type MissionEventKind = "landing" | "sunset" | "sunrise" | "contact-lost" | "contact-back" | "hibernate" | "wake" | "battery-low" | "power-lost" | "end";

export interface MissionEvent { timeMs: number; kind: MissionEventKind }
export interface MissionSample { timeMs: number; sun: boolean; earth: boolean; batteryPct: number; mode: MissionMode }

/** 给用户的建议：key 由界面翻译，values 是要填进去的数字。 */
export interface MissionAdvice { key: "battery-for-night" | "more-sunlight" | "relay-for-contact" | "downlink-too-slow" | "comfortable"; values: Record<string, number> }

export interface MissionResult {
  outcome: MissionOutcome;
  startMs: number;
  endMs: number;
  failedAtMs: number | null;
  /** 0~1：任务期间正常工作的时间占比（失电后都算不工作）。 */
  operatingFraction: number;
  sunFraction: number;
  earthFraction: number;
  minBatteryPct: number;
  longestDarkH: number;
  longestNoContactH: number;
  /** 满电时只靠电池保命能撑多久（小时）；有核电源够保命就是 Infinity。 */
  batteryEnduranceH: number;
  energyGeneratedKWh: number;
  energyUsedKWh: number;
  dataGeneratedGB: number;
  dataReturnedGB: number;
  /** 0~100 的综合分数。 */
  score: number;
  samples: MissionSample[];
  events: MissionEvent[];
  advice: MissionAdvice[];
}

/** 按时间顺序查询"某一时刻在不在某个时间段里"（时间只往前走，用游标，不用每次从头找）。 */
function intervalCursor(intervals: Interval[]) {
  let i = 0;
  return (timeMs: number) => {
    while (i < intervals.length && intervals[i].endMs <= timeMs) i++;
    return i < intervals.length && intervals[i].startMs <= timeMs;
  };
}

export function simulateMission(config: MissionConfig, windows: MissionWindows): MissionResult {
  const startMs = config.startMs;
  const endMs = startMs + config.durationDays * 24 * HOUR_MS;
  const steps = Math.ceil((endMs - startMs) / (STEP_H * HOUR_MS));
  const sampleEvery = Math.max(1, Math.ceil(steps / MAX_SAMPLES));
  const sunAt = intervalCursor(windows.sun);
  const earthAt = intervalCursor(windows.earth);
  const operatingW = operatingLoadW(config);
  const survivalW = survivalLoadW(config);
  const capacityWh = Math.max(config.batteryWh, 1);

  let batteryWh = capacityWh; // 着陆时满电
  let minBattery = 1;
  let failedAtMs: number | null = null;
  let operatingH = 0, sunH = 0, earthH = 0;
  let darkRunH = 0, longestDarkH = 0, noContactRunH = 0, longestNoContactH = 0;
  let generatedWh = 0, usedWh = 0, dataGeneratedMB = 0, dataReturnedMB = 0, backlogMB = 0;
  let lowArmed = true;
  let prev: { sun: boolean; earth: boolean; mode: MissionMode } | null = null;
  const samples: MissionSample[] = [];
  const events: MissionEvent[] = [{ timeMs: startMs, kind: "landing" }];
  const addEvent = (timeMs: number, kind: MissionEventKind) => {
    if (events.length < MAX_EVENTS || kind === "power-lost") events.push({ timeMs, kind });
  };

  for (let step = 0; step < steps; step++) {
    const t = startMs + step * STEP_H * HOUR_MS;
    const dtH = Math.min(STEP_H, (endMs - t) / HOUR_MS);
    const mid = t + (dtH * HOUR_MS) / 2;
    const sun = sunAt(mid);
    const earth = earthAt(mid);
    const generationW = (sun ? config.solarW : 0) + config.nuclearW;

    let mode: MissionMode = "failed";
    if (failedAtMs === null) {
      const wakeLevel: number = prev?.mode === "hibernating" ? WAKE_FRACTION : RESERVE_FRACTION;
      const canOperate: boolean = generationW >= operatingW || batteryWh / capacityWh > wakeLevel;
      mode = canOperate ? "operating" : "hibernating";
      const loadW = mode === "operating" ? operatingW : survivalW;
      const netWh = (generationW - loadW) * dtH;
      generatedWh += generationW * dtH;
      usedWh += loadW * dtH;
      batteryWh = netWh > 0 ? Math.min(capacityWh, batteryWh + netWh * CHARGE_EFFICIENCY) : batteryWh + netWh;
      if (batteryWh < 0) {
        batteryWh = 0;
        failedAtMs = t;
        mode = "failed";
        addEvent(t, "power-lost");
      }
      if (mode === "operating") {
        operatingH += dtH;
        dataGeneratedMB += config.dataMBPerHour * dtH;
        backlogMB += config.dataMBPerHour * dtH;
      }
      if (earth && mode !== "failed") {
        const sent = Math.min(backlogMB, config.downlinkMBPerHour * dtH);
        backlogMB -= sent;
        dataReturnedMB += sent;
      }
    }

    const fraction = batteryWh / capacityWh;
    minBattery = Math.min(minBattery, fraction);
    if (fraction < LOW_BATTERY_FRACTION && lowArmed && failedAtMs === null) {
      addEvent(t, "battery-low");
      lowArmed = false;
    }
    if (fraction > 2 * LOW_BATTERY_FRACTION) lowArmed = true;

    if (sun) { sunH += dtH; darkRunH = 0; } else { darkRunH += dtH; longestDarkH = Math.max(longestDarkH, darkRunH); }
    if (earth) { earthH += dtH; noContactRunH = 0; } else { noContactRunH += dtH; longestNoContactH = Math.max(longestNoContactH, noContactRunH); }

    if (prev) {
      if (prev.sun && !sun) addEvent(t, "sunset");
      if (!prev.sun && sun) addEvent(t, "sunrise");
      if (prev.earth && !earth) addEvent(t, "contact-lost");
      if (!prev.earth && earth) addEvent(t, "contact-back");
      if (prev.mode === "operating" && mode === "hibernating") addEvent(t, "hibernate");
      if (prev.mode === "hibernating" && mode === "operating") addEvent(t, "wake");
    } else {
      if (!sun) addEvent(t, "sunset");
      if (!earth) addEvent(t, "contact-lost");
    }
    prev = { sun, earth, mode };
    if (step % sampleEvery === 0) samples.push({ timeMs: t, sun, earth, batteryPct: fraction * 100, mode });
  }
  samples.push({ timeMs: endMs, sun: prev?.sun ?? false, earth: prev?.earth ?? false, batteryPct: (batteryWh / capacityWh) * 100, mode: prev?.mode ?? "operating" });
  events.push({ timeMs: endMs, kind: "end" });

  const totalH = (endMs - startMs) / HOUR_MS;
  const operatingFraction = operatingH / totalH;
  const earthFraction = earthH / totalH;
  const returnedRatio = dataGeneratedMB > 0 ? dataReturnedMB / dataGeneratedMB : 1;
  const crewedContactGap = config.crewed && longestNoContactH > 24;
  const outcome: MissionOutcome = failedAtMs !== null ? "failed" : operatingFraction < 0.5 || crewedContactGap || returnedRatio < 0.5 ? "partial" : "success";
  const survivedFraction = failedAtMs === null ? 1 : (failedAtMs - startMs) / (endMs - startMs);
  const rawScore = 100 * (0.45 * operatingFraction + 0.25 * Math.min(1, earthFraction / 0.8) + 0.15 * returnedRatio + 0.15 * Math.min(1, minBattery / 0.1));
  const score = Math.round(failedAtMs === null ? rawScore : rawScore * survivedFraction * 0.5);
  const netSurvivalW = survivalW - config.nuclearW;
  const batteryEnduranceH = netSurvivalW <= 0 ? Infinity : capacityWh / netSurvivalW;

  return {
    outcome,
    startMs,
    endMs,
    failedAtMs,
    operatingFraction,
    sunFraction: sunH / totalH,
    earthFraction,
    minBatteryPct: minBattery * 100,
    longestDarkH,
    longestNoContactH,
    batteryEnduranceH,
    energyGeneratedKWh: generatedWh / 1000,
    energyUsedKWh: usedWh / 1000,
    dataGeneratedGB: dataGeneratedMB / 1024,
    dataReturnedGB: dataReturnedMB / 1024,
    score,
    samples,
    events,
    advice: adviceFor(config, { failed: failedAtMs !== null, operatingFraction, sunFraction: sunH / totalH, longestDarkH, longestNoContactH, returnedRatio, minBattery, netSurvivalW }),
  };
}

function adviceFor(config: MissionConfig, r: { failed: boolean; operatingFraction: number; sunFraction: number; longestDarkH: number; longestNoContactH: number; returnedRatio: number; minBattery: number; netSurvivalW: number }): MissionAdvice[] {
  const advice: MissionAdvice[] = [];
  if (r.failed || r.minBattery < 0.1) {
    // 撑过最长一段黑夜所需的电池（休眠用电 × 黑夜时长，再留 20% 余量 + 25% 保留电量）
    const neededKWh = Math.max(0, (r.netSurvivalW * r.longestDarkH * 1.2) / (1 - RESERVE_FRACTION) / 1000);
    advice.push({ key: "battery-for-night", values: { darkH: Math.round(r.longestDarkH), batteryKWh: Math.ceil(neededKWh * 10) / 10, nuclearW: Math.ceil(survivalLoadW(config) / 100) * 100 } });
  }
  if (r.operatingFraction < 0.6) advice.push({ key: "more-sunlight", values: { sunPct: Math.round(r.sunFraction * 100) } });
  if (r.longestNoContactH > (config.crewed ? 24 : 72)) advice.push({ key: "relay-for-contact", values: { gapH: Math.round(r.longestNoContactH) } });
  if (r.returnedRatio < 0.8) advice.push({ key: "downlink-too-slow", values: { returnedPct: Math.round(r.returnedRatio * 100) } });
  if (advice.length === 0) advice.push({ key: "comfortable", values: { minBatteryPct: Math.round(r.minBattery * 100) } });
  return advice;
}
