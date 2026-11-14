// 预设点位。目前只放原型里已经用真实数据做过场景的 4 个点（来源：prototypes/lunar-scene-demo/sites.js
// 和 data/derived/*_meta.json）。中美俄其他著名着陆点的坐标必须有出处，等 TODO Q3 定了再补，不凭记忆写。
import type { Preset } from "../types";

const PROTOTYPE_SOURCE = "prototypes/lunar-scene-demo/sites.js (positions picked from NASA LOLA 10 m/px terrain)";

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
];

export function listPresets(): readonly Preset[] {
  return PRESETS;
}
