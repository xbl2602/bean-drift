// 跨模块共享的数据结构。改这里 = 改接口约定，必须同步 docs/SHARED_INTERFACES.md。
// 单位、坐标、时间约定见 docs/DATA_FLOW.md 第 3 节。

/** 一个月面位置。经度东经为正，规范到 [-180, 180]。 */
export interface LunarPosition {
  latDeg: number;
  lonDeg: number;
}

/** 数据来源说明：任何对外返回的数值都要能说清"从哪来、什么精度"。 */
export interface Provenance {
  /** 机器可读的状态：ok = 真实数据；unavailable = 这类数据还没接入（值为 null）。 */
  status: "ok" | "unavailable";
  source: string;
  note: string;
}

/** 太阳或地球在某点天空中的方向（相对"光滑球面的水平线"，未考虑地形遮挡）。 */
export interface SkyDirection {
  /** 罗盘方位：正北 0°，向东增加。 */
  azimuthDeg: number;
  /** 高度角：0° = 球面地平线，90° = 头顶。 */
  elevationDeg: number;
  /** 高度角 > 0 时为 true。注意：不含地形遮挡，真实可见性需要地平线数据（尚未接入）。 */
  aboveSphericalHorizon: boolean;
}

export interface SunSkyDirection extends SkyDirection {
  /** 观察点到太阳的距离，km（太阳用低精度模型，取整到 1000 km）。 */
  distanceKm: number;
  /** 太阳视半径，度（约 0.27）。处理地形部分遮挡时要用。 */
  angularRadiusDeg: number;
}

export interface EarthSkyDirection extends SkyDirection {
  /** 观察点到地心的距离，km。 */
  distanceKm: number;
  /** 地球视半径，度。 */
  angularRadiusDeg: number;
  /** 从该点看到的地球被照亮的比例，0~1。 */
  illuminatedFraction: number;
}

// ---- 下面三组（terrain / visibility / yearStats）是"先留好的接口"：永远存在，没有数据时字段为 null。 ----
// 接入数据时只改 src/core/data/，调用方不用动。字段表和状态见 docs/SHARED_INTERFACES.md 第 2 节。
// 怎么判断 null 的含义：看 provenance.<组>.status——unavailable = 还没接入；ok = 已接入，此时 null = "这里没有这个量"。

/** 地平线剖面的一个采样：某个方位上地形挡住的仰角。 */
export interface HorizonSample {
  /** 方位角：正北 0°，向东增加。 */
  azimuthDeg: number;
  /** 地形遮挡仰角，度。 */
  elevationDeg: number;
}

/** 地形（需要 LOLA 衍生数据，TODO Q4/Q5）。 */
export interface TerrainParameters {
  /** 海拔，米，相对 1737.4 km 参考球。 */
  heightM: number | null;
  /** 坡度，度。 */
  slopeDeg: number | null;
  /** 坡向：下坡方向的方位角，度（正北 0°，向东增加）。 */
  aspectDeg: number | null;
  /** 地平线剖面，按方位角排序。采样间隔写在 provenance.terrain.note。 */
  horizonProfile: HorizonSample[] | null;
  /** 以上数值来自多少米/像素的数据。 */
  resolutionM: number | null;
}

/** 太阳或地球在"此刻"被地形遮挡后的可见性。需要 terrain 的地平线数据。 */
export interface BodyVisibility {
  /** 圆盘露在地形地平线之上的比例：0 = 全挡住，1 = 全可见。"可见"定义为 > 0。 */
  diskVisibleFraction: number | null;
  /** 下一次从地形地平线后升起（由不可见变可见）的时刻，UTC ISO 8601。 */
  nextRiseUtc: string | null;
  /** 下一次落到地形地平线之下（由可见变不可见）的时刻，UTC ISO 8601。 */
  nextSetUtc: string | null;
}

export interface Visibility {
  sun: BodyVisibility;
  earth: BodyVisibility;
}

/** 一段连续时间。 */
export interface TimeWindow {
  startUtc: string;
  endUtc: string;
  durationH: number;
}

/** 一个天体在统计期内的可见性统计。太阳：断电 = 不可见；地球：断信号 = 不可见。 */
export interface BodyYearStats {
  /** 统计期内可见的时间占比，0~1。 */
  visibleFraction: number | null;
  /** 统计期内最长一次连续不可见，小时（L4/L5）。从未可见 = 整个统计期。 */
  longestOutageH: number | null;
  /** 统计期内所有连续不可见时段的平均时长，小时（L6）。从未不可见 = 0。 */
  meanOutageH: number | null;
  /** 统计期内所有连续可见时段的平均时长，小时（L7）。从未可见 = 0。 */
  meanVisibleWindowH: number | null;
  /** 连续可见的窗口列表（太阳：各月昼窗口）。 */
  visibleWindows: TimeWindow[] | null;
}

/**
 * 一年统计：从 periodStartUtc 起逐小时取样的整年（口径见 docs/decisions/ 里 Q1 的决定）。
 * "可见" = 圆盘上缘高于地形地平线；被统计期首尾截断的时段按截断后的长度计入。
 */
export interface YearStats {
  /** 统计覆盖的时间范围，UTC ISO 8601（起点含、终点不含）。 */
  periodStartUtc: string | null;
  periodEndUtc: string | null;
  sun: BodyYearStats;
  earth: BodyYearStats;
  /** 统计期内太阳和地球**同时**可见的时间占比，0~1：选址要两者都满足，这个比单看任一个更能说明问题。 */
  bothVisibleFraction: number | null;
}

/** 查点位时可以选填的假设。 */
export interface PointQueryOptions {
  /**
   * 地球要高过多少度才算能通信（按地球圆盘上缘，和"可见"同口径）；不传 = 只看地形，和整月地图一致。
   * 只影响地球，不影响太阳。
   */
  minEarthElevationDeg?: number;
  /**
   * 一年统计（yearStats）从哪一刻开始算，毫秒时间戳（UTC）；不传 = 2030-01-01T00:00:00Z。
   * 统计期固定是 8760 小时，所以传"发射时刻"就得到"发射后一年"。
   */
  statsStartMs?: number;
}

/** 点位参数（PointConditions）。没有数据的字段为 null，并在 provenance 里说明。 */
export interface PointConditions {
  position: LunarPosition;
  /** 查询时刻，UTC，ISO 8601。 */
  timeUtc: string;
  sun: SunSkyDirection;
  earth: EarthSkyDirection;
  terrain: TerrainParameters;
  visibility: Visibility;
  yearStats: YearStats;
  provenance: {
    ephemeris: Provenance;
    terrain: Provenance;
    visibility: Provenance;
    yearStats: Provenance;
  };
  /** 这次计算用了哪些可选假设，让调用方不用猜。 */
  assumptions: {
    /** 地球最低仰角，度；null = 没加这条要求（只看地形）。 */
    minEarthElevationDeg: number | null;
  };
  /** 约定说明，方便调用方不用猜。 */
  conventions: {
    longitude: string;
    azimuth: string;
    elevation: string;
    time: string;
    height: string;
    duration: string;
    fraction: string;
    moonReferenceRadiusKm: number;
  };
}

/**
 * 预设点位的种类：
 * - `landing-site`：真实着陆过的任务（登月舱、着陆器的位置）；
 * - `place`：地名中心点或原型观察点，只说明"这个地名在哪"，不是任何任务的着陆目标。
 */
export type PresetKind = "landing-site" | "place";

/** 预设点位（著名着陆点和南极地名）。坐标必须有出处（TODO Q3）。 */
export interface Preset {
  id: string;
  kind: PresetKind;
  name: string;
  nameZh: string;
  position: LunarPosition;
  description: string;
  /** 这个坐标是哪来的。 */
  positionSource: string;
}
