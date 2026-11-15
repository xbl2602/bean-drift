// 任务模拟器里的任务类型和默认参数。
// 【示意值，不是某个真实任务的数据】数量级参考公开资料里同类任务的常见配置（小型着陆器几百瓦、载人基地几十千瓦），
// 方便新手一键选好再微调。界面上必须注明 "typical values"，结论只用于比较选址和配置，不是工程设计。

export type MissionTypeId = "lander" | "rover" | "station" | "isru" | "outpost";

export interface MissionConfig {
  type: MissionTypeId;
  /** 任务时长（天，地球日）。 */
  durationDays: number;
  /** 任务开始时间（UTC 毫秒）。 */
  startMs: number;
  /** 太阳能板在阳光下的输出（瓦）。假设板子跟踪太阳，有阳光就是满功率。 */
  solarW: number;
  /** 电池容量（瓦时）。 */
  batteryWh: number;
  /** 核电源（放射性同位素或小型裂变堆）持续输出（瓦），0 = 没有。 */
  nuclearW: number;
  /** 工作时的用电（瓦）。 */
  operatingW: number;
  /** 休眠 / 保命时的用电（瓦）：夜里保温、维持最基本系统。载人基地 = 生命保障。 */
  survivalW: number;
  /** 工作时每小时产生的数据（MB）。 */
  dataMBPerHour: number;
  /** 能联系地球时每小时能传回的数据（MB）。 */
  downlinkMBPerHour: number;
  /** 直连地球通信要求的地球最低仰角（度）；null = 只看地形遮挡。 */
  minEarthElevationDeg: number | null;
  /** 有人在里面：不能休眠，断电就是任务失败；也需要随时能联系地球。 */
  crewed: boolean;
  /** 载人基地的人数（只影响用电）。 */
  crew: number;
}

export interface MissionType {
  id: MissionTypeId;
  icon: string;
  defaults: Omit<MissionConfig, "type" | "durationDays" | "startMs" | "minEarthElevationDeg" | "crew">;
  /** 建议的任务时长（天）。 */
  suggestedDays: number;
}

/** 载人基地每多一个人增加的用电（瓦）。 */
export const WATTS_PER_CREW = 1500;

export const MISSION_TYPES: MissionType[] = [
  {
    id: "lander",
    icon: "M12 3v5m-5 5h10l2 4H5l2-4Zm-2 4-2 4m14-4 2 4M9 8h6l1 5H8l1-5Z",
    suggestedDays: 14,
    defaults: { solarW: 600, batteryWh: 2_500, nuclearW: 0, operatingW: 350, survivalW: 60, dataMBPerHour: 200, downlinkMBPerHour: 900, crewed: false },
  },
  {
    id: "rover",
    icon: "M5 16a2 2 0 1 0 0 .01M19 16a2 2 0 1 0 0 .01M12 16a2 2 0 1 0 0 .01M4 13h16l-2-5H6l-2 5Zm8-5V4m-3 0h6",
    suggestedDays: 14,
    defaults: { solarW: 400, batteryWh: 1_500, nuclearW: 0, operatingW: 220, survivalW: 40, dataMBPerHour: 120, downlinkMBPerHour: 500, crewed: false },
  },
  {
    id: "station",
    icon: "M12 3v18M5 8h14M7 8l-2 13m12-13 2 13M9 3h6",
    suggestedDays: 90,
    defaults: { solarW: 1_500, batteryWh: 12_000, nuclearW: 0, operatingW: 500, survivalW: 100, dataMBPerHour: 300, downlinkMBPerHour: 1_500, crewed: false },
  },
  {
    id: "isru",
    icon: "M12 3 7 9h10l-5-6Zm-5 6v7a5 5 0 0 0 10 0V9M9 14h6",
    suggestedDays: 30,
    defaults: { solarW: 4_000, batteryWh: 25_000, nuclearW: 0, operatingW: 2_000, survivalW: 200, dataMBPerHour: 80, downlinkMBPerHour: 900, crewed: false },
  },
  {
    id: "outpost",
    icon: "M3 20h18M5 20v-6a7 7 0 0 1 14 0v6M9 20v-4h6v4M12 7V3",
    suggestedDays: 30,
    defaults: { solarW: 30_000, batteryWh: 300_000, nuclearW: 10_000, operatingW: 12_000, survivalW: 6_000, dataMBPerHour: 600, downlinkMBPerHour: 3_000, crewed: true },
  },
];

export const DURATION_CHOICES_DAYS = [3, 14, 30, 90, 180, 365];
export const NUCLEAR_CHOICES_W = [0, 100, 1_000, 10_000, 40_000];
/** Values on the scroll wheels in the setup form (each mission type's own default is added if missing). */
export const SOLAR_CHOICES_W = [0, 100, 200, 300, 400, 500, 600, 800, 1_000, 1_200, 1_500, 2_000, 2_500, 3_000, 4_000, 5_000, 6_000, 8_000, 10_000, 15_000, 20_000, 30_000, 40_000, 50_000, 75_000, 100_000, 150_000, 200_000];
export const BATTERY_CHOICES_WH = [0, 500, 1_000, 1_500, 2_000, 2_500, 3_000, 4_000, 5_000, 6_000, 8_000, 10_000, 12_000, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 75_000, 100_000, 150_000, 200_000, 300_000, 500_000, 750_000, 1_000_000, 2_000_000, 5_000_000];
export const MAX_CREW = 12;
export const EARTH_ELEVATION_CHOICES: Array<number | null> = [null, 5, 10];

export const missionType = (id: MissionTypeId) => MISSION_TYPES.find((type) => type.id === id)!;

/** 选了某种任务时的完整默认配置。 */
export function defaultConfig(id: MissionTypeId, startMs: number): MissionConfig {
  const type = missionType(id);
  return { type: id, durationDays: type.suggestedDays, startMs, minEarthElevationDeg: null, crew: id === "outpost" ? 4 : 0, ...type.defaults };
}

/** 实际工作用电：载人基地按人数加。 */
export function operatingLoadW(config: MissionConfig): number {
  return config.operatingW + (config.crewed ? Math.max(config.crew - 4, -3) * WATTS_PER_CREW : 0);
}
export function survivalLoadW(config: MissionConfig): number {
  return config.survivalW + (config.crewed ? Math.max(config.crew - 4, -3) * WATTS_PER_CREW * 0.5 : 0);
}
