// 预设点位。每个坐标都有出处（AGENTS.md 第 11 节：不凭记忆写坐标），三类来源：
//   1. 原型里用真实 LOLA/LROC 地形做过场景的点（南极 3 个 + 阿波罗 11 号）；
//   2. NASA NSSDCA 公布的阿波罗登月舱坐标（LRO 影像定位）；
//   3. IAU 月球地名库（USGS）里的官方着陆点名（Statio ...）和南极陨石坑/山的中心点。
// 登月舱和 Statio 坐标是"着陆点"；陨石坑/山的中心点只是"这个地名在哪"，不是任何任务的着陆目标。
// 新增预设：先把出处写进 positionSource，再记到 docs/CREDITS.md。
import type { LunarPosition, Preset } from "../types";

const PROTOTYPE_SOURCE = "prototypes/lunar-scene-demo/sites.js (positions picked from NASA LOLA 10 m/px terrain)";

const APOLLO_SOURCE =
  "NASA NSSDCA 'Apollo Landing Site Coordinates' (https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html): lunar module position in the Mean Earth/Polar Axis frame, " +
  "located on LRO images (Wagner et al. 2017, Icarus 283); matches the LROC 'Coordinates of Lunar Anthropogenic Targets' table (2016)";

const IAU_NOTE = "IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology, https://planetarynames.wr.usgs.gov), Moon centre points; the gazetteer guarantees coordinates only to about 2 decimal places (about 300 m)";

function apolloPreset(mission: number, nameZh: string, region: string, position: LunarPosition): Preset {
  return {
    id: `apollo-${mission}`,
    name: `Apollo ${mission}`,
    nameZh,
    position,
    description: `Apollo ${mission} lunar module position, ${region}.`,
    positionSource: APOLLO_SOURCE,
  };
}

function landerPreset(id: string, name: string, nameZh: string, description: string, gazetteerName: string, position: LunarPosition): Preset {
  return { id, name, nameZh, position, description, positionSource: `${IAU_NOTE}; feature '${gazetteerName}'` };
}

/** 南极的陨石坑/山：只给"地名中心点"，描述里写清楚这不是着陆目标。 */
function polarFeaturePreset(id: string, name: string, nameZh: string, note: string, gazetteerName: string, position: LunarPosition): Preset {
  return {
    id,
    name,
    nameZh,
    position,
    description: `${note} Centre point of the named feature, not a landing target.`,
    positionSource: `${IAU_NOTE}; feature '${gazetteerName}'`,
  };
}

const PRESETS: readonly Preset[] = [
  {
    id: "south-pole",
    name: "South Pole",
    nameZh: "月球南极",
    position: { latDeg: -90, lonDeg: 0 },
    description: "The pole itself, on the rim of Shackleton crater. Azimuth is not defined exactly at the pole.",
    positionSource: PROTOTYPE_SOURCE,
  },
  {
    id: "south-pole-ridge-a",
    name: "South Pole - Ridge A",
    nameZh: "南极 - 平缓地带 A",
    position: { latDeg: -89.71, lonDeg: 62.5 },
    description: "Gentle ground about 8.9 km from the pole.",
    positionSource: PROTOTYPE_SOURCE,
  },
  {
    id: "south-pole-ridge-b",
    name: "South Pole - Ridge B",
    nameZh: "南极 - 平缓地带 B",
    position: { latDeg: -89.61, lonDeg: 75.8 },
    description: "Flat ground about 11.9 km from the pole.",
    positionSource: PROTOTYPE_SOURCE,
  },
  {
    id: "apollo-11",
    name: "Apollo 11 - Tranquility Base",
    nameZh: "阿波罗 11 号静海基地",
    position: { latDeg: 0.67416, lonDeg: 23.47314 },
    description: "Equatorial site in Mare Tranquillitatis.",
    positionSource: "prototypes/lunar-scene-demo/data/derived/apollo11_meta.json (LROC NAC DTM APOLLO11 v1.9)",
  },
  apolloPreset(12, "阿波罗 12 号", "Oceanus Procellarum", { latDeg: -3.0128, lonDeg: -23.4219 }),
  apolloPreset(14, "阿波罗 14 号", "Fra Mauro highlands", { latDeg: -3.64589, lonDeg: -17.47194 }),
  apolloPreset(15, "阿波罗 15 号", "Hadley-Apennine region", { latDeg: 26.13239, lonDeg: 3.6333 }),
  apolloPreset(16, "阿波罗 16 号", "Descartes highlands", { latDeg: -8.9734, lonDeg: 15.5011 }),
  apolloPreset(17, "阿波罗 17 号", "Taurus-Littrow valley", { latDeg: 20.1911, lonDeg: 30.7723 }),
  landerPreset("chandrayaan-3", "Chandrayaan-3 - Shiv Shakti", "月船 3 号（Shiv Shakti 站）", "India's Chandrayaan-3 lander, in the southern highlands about 21 degrees from the pole.", "Statio Shiv Shakti", {
    latDeg: -69.3734,
    lonDeg: 32.3198,
  }),
  landerPreset("chang-e-3", "Chang'e-3 - Guang Han Gong", "嫦娥三号（广寒宫）", "Chang'e-3 lander in Mare Imbrium, the first soft landing on the Moon since 1976.", "Guang Han Gong", {
    latDeg: 44.1184,
    lonDeg: -19.5123,
  }),
  {
    id: "chang-e-4",
    name: "Chang'e-4 - Statio Tianhe",
    nameZh: "嫦娥四号（天河站）",
    position: { latDeg: -45.457, lonDeg: 177.589 },
    description: "Chang'e-4 lander inside Von Karman crater on the far side of the Moon, where there is no direct line to Earth.",
    positionSource: "NASA LROC, lander located on LRO NAC image M1298916428LR, 45.457 S 177.589 E plus or minus 20 m (https://www.lroc.asu.edu/posts/1087); IAU name 'Statio Tianhe'",
  },
  landerPreset("chang-e-5", "Chang'e-5 - Statio Tianchuan", "嫦娥五号（天川站）", "Chang'e-5 sample-return landing site in northern Oceanus Procellarum, near Mons Rumker.", "Statio Tianchuan", {
    latDeg: 43.06,
    lonDeg: -51.92,
  }),
  landerPreset("chang-e-6", "Chang'e-6 - Statio Tianjiang", "嫦娥六号（天江站）", "Chang'e-6 far-side sample-return site in the Apollo basin; no direct line to Earth.", "Statio Tianjiang", {
    latDeg: -41.63,
    lonDeg: -153.98,
  }),
  polarFeaturePreset("shackleton-crater", "Shackleton crater", "沙克尔顿陨石坑", "A 21 km crater at the south pole whose floor is in permanent shadow while parts of its rim are lit.", "Shackleton", {
    latDeg: -89.67,
    lonDeg: 129.78,
  }),
  polarFeaturePreset("mons-malapert", "Mons Malapert", "马拉珀特山", "A massif about 120 km from the pole, a high point of the south polar region.", "Mons Malapert", {
    latDeg: -85.98,
    lonDeg: -1.67,
  }),
  polarFeaturePreset("haworth-crater", "Haworth crater", "豪沃思陨石坑", "A 51 km crater near the pole with permanently shadowed floor.", "Haworth", { latDeg: -87.45, lonDeg: -5.17 }),
  polarFeaturePreset("nobile-crater", "Nobile crater", "诺比尔陨石坑", "A 79 km crater about 5 degrees from the pole.", "Nobile", {
    latDeg: -85.2752,
    lonDeg: 53.2725,
  }),
  polarFeaturePreset("faustini-crater", "Faustini crater", "福斯蒂尼陨石坑", "A 43 km crater near the pole with permanently shadowed floor.", "Faustini", { latDeg: -87.1832, lonDeg: 84.3099 }),
  polarFeaturePreset("cabeus-crater", "Cabeus crater", "卡比厄斯陨石坑", "A 100 km crater near the pole, where LCROSS found water ice in the impact plume.", "Cabeus", {
    latDeg: -85.3303,
    lonDeg: -42.1327,
  }),
  polarFeaturePreset("amundsen-crater", "Amundsen crater", "阿蒙森陨石坑", "A 103 km crater near the pole.", "Amundsen", { latDeg: -84.4398, lonDeg: 83.0691 }),
  polarFeaturePreset("de-gerlache-crater", "de Gerlache crater", "德热拉什陨石坑", "A 33 km crater about 1.5 degrees from the pole, next to Shackleton.", "de Gerlache", {
    latDeg: -88.4849,
    lonDeg: -88.3447,
  }),
  polarFeaturePreset("slater-crater", "Slater crater", "斯莱特陨石坑", "A 25 km crater about 2 degrees from the pole.", "Slater", { latDeg: -88.0792, lonDeg: 111.2881 }),
  polarFeaturePreset("mons-mouton", "Mons Mouton", "穆东山", "A 130 km massif in the south polar region; secondary sources name this area for the planned Griffin lander (exact landing point not published).", "Mons Mouton", {
    latDeg: -84.6,
    lonDeg: 31,
  }),
];

export function listPresets(): readonly Preset[] {
  return PRESETS;
}
