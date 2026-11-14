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

export interface EarthSkyDirection extends SkyDirection {
  /** 月心到地心之外的观察点到地心的距离，km。 */
  distanceKm: number;
  /** 地球视半径，度。 */
  angularRadiusDeg: number;
  /** 从该点看到的地球被照亮的比例，0~1。 */
  illuminatedFraction: number;
}

/** 点位参数（PointConditions）。尚未接入的字段为 null，并在 provenance 里说明。 */
export interface PointConditions {
  position: LunarPosition;
  /** 查询时刻，UTC，ISO 8601。 */
  timeUtc: string;
  sun: SkyDirection;
  earth: EarthSkyDirection;
  /** 地形（高度、坡度、坡向、地平线剖面）。需要 LOLA 衍生数据，尚未接入。 */
  terrain: null;
  /** 一年统计（日照比例、地球可见比例、最长断电/断信号）。公式待定（TODO Q1），尚未接入。 */
  yearStats: null;
  provenance: {
    ephemeris: Provenance;
    terrain: Provenance;
    yearStats: Provenance;
  };
  /** 约定说明，方便调用方不用猜。 */
  conventions: {
    longitude: string;
    azimuth: string;
    elevation: string;
    time: string;
    moonReferenceRadiusKm: number;
  };
}

/** 预设点位（著名着陆点）。坐标必须有出处（TODO Q3）。 */
export interface Preset {
  id: string;
  name: string;
  nameZh: string;
  position: LunarPosition;
  description: string;
  /** 这个坐标是哪来的。 */
  positionSource: string;
}
