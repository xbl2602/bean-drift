// "Landing Sites" 模式里的点位：读后端的 /api/presets，和 API、MCP、AI 窗口用同一份清单。
// 坐标和出处都在 src/core/data/presets.ts，这里不手写任何坐标。
// 这里只保留"讲解文字"和"载人/无人"分类：写了详细介绍的任务（下面的 MISSION_NOTES）显示详细介绍，其他点位直接用接口给的 description。
import type { Preset, PresetKind } from "@/core/types";
import { normalizeLonDeg, type LatLon } from "../moon-frames";

export type LandingSiteKind = "human" | "robotic";
export type LandingFilter = "all" | LandingSiteKind;

export const LANDING_FILTERS: ReadonlyArray<{ id: LandingFilter; label: string }> = [
  { id: "all", label: "All sites" },
  { id: "human", label: "Human landing sites" },
  { id: "robotic", label: "Robotic landing sites" },
];

/** 地图标记和清单里的颜色，用网站自己的配色：载人（阿波罗）= 主色黄绿（和按钮、选中状态同色），无人 = 网站的浅钢蓝。 */
export const LANDING_KIND_COLORS: Record<LandingSiteKind, string> = { human: "#bef264", robotic: "#a8c8d9" };

export interface SiteEntry extends LatLon {
  /** 和 /api/presets 里的 id 一致。 */
  id: string;
  kind: PresetKind;
  /** 载人还是无人。只有真实着陆过的任务有；南极地名（kind = "place"）是 null。 */
  crew: LandingSiteKind | null;
  /** 列表里显示的短名字。 */
  label: string;
  /** 接口里的完整名字。 */
  name: string;
  summary: string;
  /** 这个坐标是哪来的（接口里的 positionSource）。 */
  positionSource: string;
  /** 以下三项只有写了介绍的任务才有。 */
  agency?: string;
  /** 着陆日期（UTC），YYYY-MM-DD。 */
  landedUtc?: string;
  /** 这个位置的光照/通信特点，配合下面的数据看。 */
  dataNote?: string;
}

interface MissionNotes {
  /** 不写就用接口里的 name。 */
  label?: string;
  crew: LandingSiteKind;
  agency: string;
  landedUtc: string;
  /** 不写就用接口里的 description。 */
  summary?: string;
  dataNote?: string;
}

const US = "NASA · United States";
const USSR = "USSR · Soviet Union";
const CNSA = "CNSA · China";

/** 键是 /api/presets 里的 id。找不到对应预设的任务不会显示（不会用凭记忆的坐标顶上）。 */
const MISSION_NOTES: Record<string, MissionNotes> = {
  // ---- 载人：阿波罗 ----
  "apollo-11": {
    label: "Apollo 11",
    crew: "human",
    agency: US,
    landedUtc: "1969-07-20",
    summary: "The first crewed landing. Neil Armstrong and Buzz Aldrin spent about 21½ hours on the surface in Mare Tranquillitatis and returned about 21.5 kg of samples.",
    dataNote: "Near the equator on the near side: Earth stays high in the sky all the time, and the Sun is up for about half of every lunar day (about 14¾ Earth days of light, then the same of night).",
  },
  "apollo-12": {
    label: "Apollo 12",
    crew: "human",
    agency: US,
    landedUtc: "1969-11-19",
    summary: "The second crewed landing, in Oceanus Procellarum. Pete Conrad and Alan Bean touched down a short walk from the Surveyor 3 probe and brought parts of it back to Earth.",
    dataNote: "Near side, close to the equator: Earth is always high and in direct view; the Sun follows the usual two-week day and night.",
  },
  "apollo-14": {
    label: "Apollo 14",
    crew: "human",
    agency: US,
    landedUtc: "1971-02-05",
    summary: "Alan Shepard and Edgar Mitchell landed in the Fra Mauro highlands, the target of the cancelled Apollo 13, and collected about 42 kg of samples.",
    dataNote: "Near-side highlands near the equator: Earth is always in view; ridges and crater rims close by shape the horizon.",
  },
  "apollo-15": {
    label: "Apollo 15",
    crew: "human",
    agency: US,
    landedUtc: "1971-07-30",
    summary: "The first mission with the lunar rover. David Scott and James Irwin explored the Hadley–Apennine region, between the Apennine mountains and Hadley Rille.",
    dataNote: "Near side at about 26°N, beside tall mountains: Earth is always in view, but the massifs can hide a low Sun in the morning and evening.",
  },
  "apollo-16": {
    label: "Apollo 16",
    crew: "human",
    agency: US,
    landedUtc: "1972-04-21",
    summary: "John Young and Charles Duke explored the Descartes highlands, the only crewed landing in the lunar highlands, and brought back about 95 kg of samples.",
    dataNote: "Near-side highlands just south of the equator: Earth stays in view; rough, rolling ground gives a varied horizon.",
  },
  "apollo-17": {
    label: "Apollo 17",
    crew: "human",
    agency: US,
    landedUtc: "1972-12-11",
    summary: "The last crewed landing. Eugene Cernan and Harrison Schmitt, the only geologist to walk on the Moon, worked in the Taurus–Littrow valley and returned about 110 kg of samples.",
    dataNote: "A narrow valley between tall massifs on the near side: Earth is always in view, but the valley walls block the Sun at low angles.",
  },
  // ---- 无人：苏联月球号 ----
  "luna-9": {
    label: "Luna 9",
    crew: "robotic",
    agency: USSR,
    landedUtc: "1966-02-03",
    summary: "The first soft landing on the Moon. It sent back the first photographs from the surface, in Oceanus Procellarum.",
    dataNote: "Western near side: Earth is high and always in view for direct radio contact.",
  },
  "luna-13": {
    label: "Luna 13",
    crew: "robotic",
    agency: USSR,
    landedUtc: "1966-12-24",
    summary: "The second Soviet soft lander. It sent panoramic pictures and measured how firm the soil is with a small probe.",
    dataNote: "Western near side, Oceanus Procellarum: Earth is always in view.",
  },
  "luna-16": {
    label: "Luna 16",
    crew: "robotic",
    agency: USSR,
    landedUtc: "1970-09-20",
    summary: "The first robotic sample return from the Moon: about 100 g of soil from Mare Fecunditatis came back to Earth.",
    dataNote: "Eastern near side, near the equator: Earth stays in view, though low in the sky near the limb.",
  },
  "luna-17": {
    label: "Luna 17 · Lunokhod 1",
    crew: "robotic",
    agency: USSR,
    landedUtc: "1970-11-17",
    summary: "Delivered Lunokhod 1, the first remote-controlled rover on another world, to Mare Imbrium. It drove about 10 km.",
    dataNote: "Mid-northern near side: Earth is always in view; the Sun is low for part of every day at this latitude.",
  },
  "luna-20": {
    label: "Luna 20",
    crew: "robotic",
    agency: USSR,
    landedUtc: "1972-02-21",
    summary: "A sample-return mission to the highlands north of Mare Fecunditatis that brought back about 55 g of soil.",
    dataNote: "Eastern near side near the equator: Earth is in view but low towards the limb.",
  },
  "luna-21": {
    label: "Luna 21 · Lunokhod 2",
    crew: "robotic",
    agency: USSR,
    landedUtc: "1973-01-15",
    summary: "Delivered Lunokhod 2 to Le Monnier crater at the edge of Mare Serenitatis. It drove about 39 km, the longest drive on the Moon for decades.",
    dataNote: "Near side at about 26°N, close to the Apollo 17 valley: Earth is always in view.",
  },
  "luna-23": { crew: "robotic", agency: USSR, landedUtc: "1974-11-06" },
  "luna-24": {
    label: "Luna 24",
    crew: "robotic",
    agency: USSR,
    landedUtc: "1976-08-18",
    summary: "The last Soviet lunar mission. It drilled about 2 m into Mare Crisium and returned about 170 g of soil.",
    dataNote: "Eastern edge of the near side: Earth is in view but only a few degrees above the horizon, so a hill can hide it.",
  },
  // ---- 无人：美国勘测者 ----
  "surveyor-1": {
    label: "Surveyor 1",
    crew: "robotic",
    agency: US,
    landedUtc: "1966-06-02",
    summary: "NASA's first soft landing, in Oceanus Procellarum. It sent back more than 11,000 pictures.",
    dataNote: "Western near side near the equator: Earth is high and always in direct view.",
  },
  "surveyor-3": {
    label: "Surveyor 3",
    crew: "robotic",
    agency: US,
    landedUtc: "1967-04-20",
    summary: "Dug trenches in the soil with a scoop. The Apollo 12 crew later landed beside it and took parts of it home.",
    dataNote: "Near side close to the equator: Earth is always in view.",
  },
  "surveyor-5": {
    label: "Surveyor 5",
    crew: "robotic",
    agency: US,
    landedUtc: "1967-09-11",
    summary: "Made the first chemical analysis of lunar soil, in Mare Tranquillitatis, not far from where Apollo 11 would land.",
    dataNote: "Near side on the equator: Earth is high in the sky; the Sun is up for about half of each lunar day.",
  },
  "surveyor-6": {
    label: "Surveyor 6",
    crew: "robotic",
    agency: US,
    landedUtc: "1967-11-10",
    summary: "Made the first liftoff from the Moon: it fired its engines and hopped about 2.5 m to a new spot.",
    dataNote: "Centre of the near side: Earth is almost straight overhead.",
  },
  "surveyor-7": {
    label: "Surveyor 7",
    crew: "robotic",
    agency: US,
    landedUtc: "1968-01-10",
    summary: "The last Surveyor landed in the highlands north of Tycho crater and analysed highland soil and rocks.",
    dataNote: "Southern near side at about 41°S: Earth is in view but lower; the Sun stays lower in the sky.",
  },
  // ---- 无人：中国、印度、日本、美国商业 ----
  "chang-e-3": {
    label: "Chang'e 3",
    crew: "robotic",
    agency: CNSA,
    landedUtc: "2013-12-14",
    summary: "China's first lunar landing and the first soft landing on the Moon since 1976, in northern Mare Imbrium. It carried the Yutu rover.",
    dataNote: "Mid-latitude near side: Earth is always in view for direct radio contact, but the lander still has to survive two-week nights.",
  },
  "chang-e-4": {
    label: "Chang'e 4",
    crew: "robotic",
    agency: CNSA,
    landedUtc: "2019-01-03",
    summary: "The first soft landing on the far side, in Von Kármán crater inside the South Pole–Aitken basin, with the Yutu-2 rover.",
    dataNote: "Far side: Earth never rises here, so every message went through the Queqiao relay satellite. Compare its Earth-in-view value with Apollo 11.",
  },
  "chang-e-5": {
    label: "Chang'e 5",
    crew: "robotic",
    agency: CNSA,
    landedUtc: "2020-12-01",
    summary: "A sample-return mission to Oceanus Procellarum near Mons Rümker. It brought about 1.7 kg of young volcanic rock back to Earth.",
    dataNote: "Near side with direct Earth contact; the surface work was planned to finish within one lunar daytime.",
  },
  "chandrayaan-3": {
    label: "Chandrayaan-3",
    crew: "robotic",
    agency: "ISRO · India",
    landedUtc: "2023-08-23",
    summary: "India's first soft landing: the Vikram lander and Pragyan rover, the first to land this far south (about 69°S).",
    dataNote: "High southern latitude: the Sun stays low, so shadows are long and slopes matter. The mission was designed for one lunar daytime.",
  },
  "im-1-odysseus": { crew: "robotic", agency: "Intuitive Machines · United States", landedUtc: "2024-02-22" },
  slim: {
    label: "SLIM",
    crew: "robotic",
    agency: "JAXA · Japan",
    landedUtc: "2024-01-19",
    summary: "Japan's first Moon landing, a precision touchdown near Shioli crater. It came to rest tilted, but kept working and survived a lunar night.",
    dataNote: "Near side south of the equator: Earth is in view; the lander's solar panels faced west, so light mattered more than usual.",
  },
  "chang-e-6": {
    label: "Chang'e 6",
    crew: "robotic",
    agency: CNSA,
    landedUtc: "2024-06-01",
    summary: "The first samples from the far side (about 1.9 kg), collected in the Apollo basin inside the South Pole–Aitken basin.",
    dataNote: "Far side: no direct line of sight to Earth, so it relied on the Queqiao-2 relay satellite.",
  },
  "blue-ghost-1": {
    label: "Blue Ghost Mission 1",
    crew: "robotic",
    agency: "Firefly Aerospace · United States",
    landedUtc: "2025-03-02",
    summary: "The first fully successful commercial Moon landing, in Mare Crisium. It worked for about a lunar day, carrying NASA science instruments.",
    dataNote: "Eastern near side: Earth is in view but low in the sky; the mission planned for roughly 14 Earth days of daylight.",
  },
  "im-2-athena": { crew: "robotic", agency: "Intuitive Machines · United States", landedUtc: "2025-03-06" },
};

/** 写了介绍的任务 id（给测试用：id 写错的话，对应介绍会悄悄不显示）。 */
export const MISSION_NOTE_IDS: readonly string[] = Object.keys(MISSION_NOTES);

function toSiteEntry(preset: Preset): SiteEntry {
  const notes = MISSION_NOTES[preset.id];
  return {
    id: preset.id,
    kind: preset.kind,
    // 没有写介绍的真实着陆点，一律按无人任务算；南极地名不是任务，没有载人/无人之分
    crew: preset.kind === "landing-site" ? (notes?.crew ?? "robotic") : null,
    label: notes?.label ?? preset.name,
    name: preset.name,
    latDeg: preset.position.latDeg,
    lonDeg: preset.position.lonDeg,
    summary: notes?.summary ?? preset.description,
    positionSource: preset.positionSource,
    agency: notes?.agency,
    landedUtc: notes?.landedUtc,
    dataNote: notes?.dataNote,
  };
}

/** 真实着陆点按着陆日期排（没有日期的排最后），南极地名接在后面，顺序用接口给的。 */
function orderSites(entries: SiteEntry[]): SiteEntry[] {
  const missions = entries.filter((site) => site.kind === "landing-site").sort((a, b) => (a.landedUtc ?? "9999").localeCompare(b.landedUtc ?? "9999"));
  return [...missions, ...entries.filter((site) => site.kind !== "landing-site")];
}

/** 取预设点位清单。失败（网络、接口出错）就抛错，由调用方显示"加载失败"。 */
export async function loadPresetSites(): Promise<SiteEntry[]> {
  const response = await fetch("/api/presets");
  if (!response.ok) throw new Error(`/api/presets returned ${response.status}`);
  const body: { presets?: Preset[] } = await response.json();
  if (!Array.isArray(body.presets)) throw new Error("/api/presets returned no presets");
  return orderSites(body.presets.map(toSiteEntry));
}

/** 按"全部 / 载人 / 无人"筛选。选载人或无人时，南极地名（不是任务）不在里面。 */
export function filterLandingSites(sites: readonly SiteEntry[], filter: LandingFilter): SiteEntry[] {
  return filter === "all" ? [...sites] : sites.filter((site) => site.crew === filter);
}

/** 点地图时选最近的一个点（距离在 radiusDeg 度以内，经度差按纬度缩放），没有就返回 null。 */
export function nearestSite(sites: readonly SiteEntry[], point: LatLon, radiusDeg: number): SiteEntry | null {
  let best: SiteEntry | null = null;
  let bestDistance = radiusDeg;
  for (const site of sites) {
    const dLat = site.latDeg - point.latDeg;
    const dLon = normalizeLonDeg(site.lonDeg - point.lonDeg) * Math.cos((point.latDeg * Math.PI) / 180);
    const distance = Math.hypot(dLat, dLon);
    if (distance < bestDistance) {
      best = site;
      bestDistance = distance;
    }
  }
  return best;
}
