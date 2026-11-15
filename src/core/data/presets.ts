// 预设点位。每个坐标都有出处（AGENTS.md 第 11 节：不凭记忆写坐标），来源有这几类：
//   1. 原型里用真实 LOLA/LROC 地形做过场景的点（南极 3 个 + 阿波罗 11 号）；
//   2. NASA NSSDCA 公布的阿波罗登月舱坐标（LRO 影像定位）；
//   3. IAU 月球地名库（USGS）里的官方着陆点名（Statio ...）和南极陨石坑/山的中心点；
//   4. LROC 团队 2016 年的"人造物体坐标表"（勘测者号、月球号）；
//   5. NASA / LROC 官方页面对 2024 年以后着陆器的定位（SLIM、IM-1、IM-2、Blue Ghost 1）。
// kind = "landing-site" 是真实着陆过的任务；kind = "place" 只是"这个地名在哪"，不是任何任务的着陆目标。
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
    kind: "landing-site",
    name: `Apollo ${mission}`,
    nameZh,
    position,
    description: `Apollo ${mission} lunar module position, ${region}.`,
    positionSource: APOLLO_SOURCE,
  };
}

function landerPreset(id: string, name: string, nameZh: string, description: string, gazetteerName: string, position: LunarPosition): Preset {
  return { id, kind: "landing-site", name, nameZh, position, description, positionSource: `${IAU_NOTE}; feature '${gazetteerName}'` };
}

/**
 * LROC 2016 人造物体坐标表里的着陆器。表里经度是 0~360 东经，这里已换成 -180~180（东经为正）。
 * uncertaintyM 是表里给的这个点的定位不确定度（米）。
 */
function lrocTablePreset(id: string, name: string, nameZh: string, description: string, tableName: string, uncertaintyM: number, position: LunarPosition): Preset {
  return {
    id,
    kind: "landing-site",
    name,
    nameZh,
    position,
    description,
    positionSource:
      "LROC Science Operations Team, 'Coordinates of Lunar Anthropogenic Targets' (28 July 2016, https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Robotic_Spacecraft.pdf): " +
      `mean observed position of '${tableName}' in the Mean Earth/Polar Axis frame, uncertainty ${uncertaintyM} m; longitude converted from 0-360 E to -180..180 E`,
  };
}

/** 只有维基百科人造物体清单给了坐标的着陆器（精度比 LROC 表低，来源里写明"待复核"）。 */
function wikipediaListPreset(id: string, name: string, nameZh: string, description: string, position: LunarPosition): Preset {
  return {
    id,
    kind: "landing-site",
    name,
    nameZh,
    position,
    description,
    positionSource:
      "Wikipedia, 'List of artificial objects on the Moon' (https://en.wikipedia.org/wiki/List_of_artificial_objects_on_the_Moon), which cites NASA/LROC and space-agency sources: " +
      "degrees-minutes converted to decimal degrees, precision about 0.01 degrees (about 300 m). Not in the LROC 2016 table; less accurate than the other landers here and still to be double-checked",
  };
}

/** 南极的陨石坑/山：只给"地名中心点"，描述里写清楚这不是着陆目标。 */
function polarFeaturePreset(id: string, name: string, nameZh: string, note: string, gazetteerName: string, position: LunarPosition): Preset {
  return {
    id,
    kind: "place",
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
    kind: "place",
    name: "South Pole",
    nameZh: "月球南极",
    position: { latDeg: -90, lonDeg: 0 },
    description: "The pole itself, on the rim of Shackleton crater. Azimuth is not defined exactly at the pole.",
    positionSource: PROTOTYPE_SOURCE,
  },
  {
    id: "south-pole-ridge-a",
    kind: "place",
    name: "South Pole - Ridge A",
    nameZh: "南极 - 平缓地带 A",
    position: { latDeg: -89.71, lonDeg: 62.5 },
    description: "Gentle ground about 8.9 km from the pole.",
    positionSource: PROTOTYPE_SOURCE,
  },
  {
    id: "south-pole-ridge-b",
    kind: "place",
    name: "South Pole - Ridge B",
    nameZh: "南极 - 平缓地带 B",
    position: { latDeg: -89.61, lonDeg: 75.8 },
    description: "Flat ground about 11.9 km from the pole.",
    positionSource: PROTOTYPE_SOURCE,
  },
  {
    id: "apollo-11",
    kind: "landing-site",
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
    kind: "landing-site",
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
  // ---- 2026-11-15 新增：南极着陆器（NASA / LROC 官方页面定位） ----
  {
    id: "im-1-odysseus",
    kind: "landing-site",
    name: "IM-1 - Odysseus",
    nameZh: "IM-1（奥德修斯号）",
    position: { latDeg: -80.13, lonDeg: 1.44 },
    description:
      "Intuitive Machines' Nova-C lander Odysseus, about 10 degrees from the pole: the first US soft landing since Apollo 17. It came to rest inside a degraded 1 km crater on a 12 degree slope, at 2,579 m elevation.",
    positionSource: "NASA, 'NASA's LRO Images Intuitive Machines' Odysseus Lander' (https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/): 80.13 S 1.44 E, LROC NAC frame M1463440322L",
  },
  {
    id: "im-2-athena",
    kind: "landing-site",
    name: "IM-2 - Athena",
    nameZh: "IM-2（雅典娜号）",
    position: { latDeg: -84.7906, lonDeg: 29.1957 },
    description:
      "Intuitive Machines' IM-2 lander Athena, about 5 degrees from the pole near Mons Mouton, the southernmost landing as of 2025. It hit the surface faster than intended and ended up on its side in a 20 m crater, but still returned data.",
    positionSource:
      "LROC, 'IM-2 Athena Seen Obliquely' (https://lroc.im-ldi.com/images/1408): 84.7906 S 29.1957 E; the intended site was 84.78 S 29.13 E (https://lroc.im-ldi.com/images/1401)",
  },
  // ---- 其他地区的着陆器（LROC 人造物体坐标表 / NASA、LROC 官方页面） ----
  lrocTablePreset("surveyor-1", "Surveyor 1", "勘测者 1 号", "NASA Surveyor 1 lander (1966) in Oceanus Procellarum: the first US soft landing on the Moon.", "Surveyor 1", 5.6, { latDeg: -2.4745, lonDeg: -43.3398 }),
  lrocTablePreset("surveyor-3", "Surveyor 3", "勘测者 3 号", "NASA Surveyor 3 lander (1967) in Oceanus Procellarum, about 160 m from where the Apollo 12 lunar module landed in 1969.", "Surveyor 3", 2.6, {
    latDeg: -3.0162,
    lonDeg: -23.418,
  }),
  lrocTablePreset("surveyor-5", "Surveyor 5", "勘测者 5 号", "NASA Surveyor 5 lander (1967) in Mare Tranquillitatis, about 25 km from where Apollo 11 landed two years later.", "Surveyor 5", 11.9, {
    latDeg: 1.4551,
    lonDeg: 23.1943,
  }),
  lrocTablePreset("surveyor-6", "Surveyor 6", "勘测者 6 号", "NASA Surveyor 6 lander (1967) in Sinus Medii, close to the centre of the near side.", "Surveyor 6", 6.7, { latDeg: 0.4742, lonDeg: -1.4275 }),
  lrocTablePreset("surveyor-7", "Surveyor 7", "勘测者 7 号", "NASA Surveyor 7 lander (1968) in the highlands just north of Tycho crater, the last Surveyor.", "Surveyor 7", 3.5, {
    latDeg: -40.9812,
    lonDeg: -11.5127,
  }),
  // Luna 9 和 Luna 13 不在 LROC 2016 坐标表里。坐标取自维基百科"List of artificial objects on the Moon"（该表引用 NASA/LROC 和各国航天机构资料），
  // 度分秒换算成十进制度，精度约 0.01°（约 300 m），是 chanjy0806 在产品页清单里查的；比 LROC 表差一档，待 xbl2602 / leeziqi0531-debug 复核。
  wikipediaListPreset("luna-9", "Luna 9", "月球 9 号", "Soviet Luna 9 lander (1966) in Oceanus Procellarum: the first soft landing on the Moon, which sent back the first pictures from the surface.", { latDeg: 7.0833, lonDeg: -64.3667 }),
  wikipediaListPreset("luna-13", "Luna 13", "月球 13 号", "Soviet Luna 13 lander (1966) in Oceanus Procellarum: the second Soviet soft landing, which sent panoramas and measured how firm the soil is.", { latDeg: 18.8667, lonDeg: -62.05 }),
  lrocTablePreset("luna-16", "Luna 16", "月球 16 号", "Soviet Luna 16 (1970) in Mare Fecunditatis: the first robotic sample return from the Moon.", "Luna 16", 3.7, { latDeg: -0.5137, lonDeg: 56.3638 }),
  lrocTablePreset("luna-17", "Luna 17 - Lunokhod 1", "月球 17 号（月球车 1 号）", "Soviet Luna 17 lander (1970) in Mare Imbrium; it carried the Lunokhod 1 rover. The position is the lander, not the rover's last stop.", "Luna 17", 0.5, {
    latDeg: 38.23764,
    lonDeg: -35.00163,
  }),
  lrocTablePreset("luna-20", "Luna 20", "月球 20 号", "Soviet Luna 20 sample-return lander (1972) in the Apollonius highlands.", "Luna 20", 4.3, { latDeg: 3.7863, lonDeg: 56.6242 }),
  lrocTablePreset("luna-21", "Luna 21 - Lunokhod 2", "月球 21 号（月球车 2 号）", "Soviet Luna 21 lander (1973) in Le Monnier crater at the edge of Mare Serenitatis; it carried the Lunokhod 2 rover. The position is the lander, not the rover's last stop.", "Luna 21", 13.4, {
    latDeg: 25.9994,
    lonDeg: 30.4076,
  }),
  lrocTablePreset("luna-23", "Luna 23", "月球 23 号", "Soviet Luna 23 lander (1974) in southern Mare Crisium. It was damaged in landing and returned no samples.", "Luna 23", 3.0, { latDeg: 12.6667, lonDeg: 62.1511 }),
  lrocTablePreset("luna-24", "Luna 24", "月球 24 号", "Soviet Luna 24 sample-return lander (1976) in southern Mare Crisium, the last Soviet lunar landing.", "Luna 24", 3.7, { latDeg: 12.7142, lonDeg: 62.2129 }),
  {
    id: "slim",
    kind: "landing-site",
    name: "SLIM",
    nameZh: "SLIM（日本智能着陆器）",
    position: { latDeg: -13.316, lonDeg: 25.251 },
    description: "JAXA's SLIM pinpoint-landing demonstrator (2024), landed near the small Shioli crater on the near side, at -912 m elevation.",
    positionSource: "NASA, 'NASA's LRO Spots Japan's Moon Lander' (https://www.nasa.gov/missions/lro/nasas-lro-spots-japans-moon-lander/): 13.3160 S 25.2510 E, LROC NAC image of 2024-01-24",
  },
  {
    id: "blue-ghost-1",
    kind: "landing-site",
    name: "Blue Ghost Mission 1",
    nameZh: "蓝幽灵 1 号（Blue Ghost M1）",
    position: { latDeg: 18.5623, lonDeg: 61.8103 },
    description: "Firefly Aerospace's Blue Ghost lander (2025) in eastern Mare Crisium near Mons Latreille, sitting on the rim of a 12 m crater at -3,650 m elevation.",
    positionSource: "LROC, 'Blue Ghost Lunar Lander Seen From Above' (https://lroc.im-ldi.com/images/1407): 18.5623 N 61.8103 E, -3650 m elevation",
  },
  // ---- 2026-11-15 新增：更多南极地名（IAU 地名库中心点，不是着陆目标） ----
  polarFeaturePreset("shoemaker-crater", "Shoemaker crater", "舒梅克陨石坑", "A 52 km crater about 1.9 degrees from the pole.", "Shoemaker", { latDeg: -88.137, lonDeg: 45.911 }),
  polarFeaturePreset("sverdrup-crater", "Sverdrup crater", "斯韦德鲁普陨石坑", "A 33 km crater about 1.7 degrees from the pole.", "Sverdrup", { latDeg: -88.3209, lonDeg: -153.3875 }),
  polarFeaturePreset("henson-crater", "Henson crater", "亨森陨石坑", "A 43 km crater about 1.4 degrees from the pole.", "Henson", { latDeg: -88.57, lonDeg: -130.63 }),
  polarFeaturePreset("wiechert-crater", "Wiechert crater", "维歇特陨石坑", "A 41 km crater about 6 degrees from the pole.", "Wiechert", { latDeg: -84.0334, lonDeg: 164.701 }),
  polarFeaturePreset("kocher-crater", "Kocher crater", "科歇尔陨石坑", "A 24 km crater about 5.5 degrees from the pole.", "Kocher", { latDeg: -84.4671, lonDeg: -134.0244 }),
  polarFeaturePreset("oberbeck-crater", "Oberbeck crater", "奥伯贝克陨石坑", "A 58 km crater about 6.5 degrees from the pole.", "Oberbeck", { latDeg: -83.55, lonDeg: 68.14 }),
  polarFeaturePreset("scott-crater", "Scott crater", "斯科特陨石坑", "A 108 km crater about 7.6 degrees from the pole.", "Scott", { latDeg: -82.3532, lonDeg: 48.5154 }),
];

export function listPresets(): readonly Preset[] {
  return PRESETS;
}
