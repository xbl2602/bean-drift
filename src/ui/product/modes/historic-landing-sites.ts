// "Landing Sites" 模式里的真实着陆点（载人 6 个 + 无人 19 个，共 25 个成功软着陆的任务）。
// 坐标来源有两种，都在 docs/CREDITS.md 第 5 节登记：
//  1. IAU 官方月面地名表里的 "Statio"（着陆站）条目——IAU 只给 6 个着陆点批准了名字，这里直接按名字取，不手写坐标；
//  2. 其余任务：坐标取自维基百科 "List of artificial objects on the Moon"（该表引用 NASA/LROC 和各国航天机构的资料），
//     度分秒换算成十进制度，精度约 0.01°（约 300 m）。**待 xbl2602 / leeziqi0531-debug 复核。**
// 只收"成功软着陆"的任务；撞毁的（Luna 25、Beresheet、Chandrayaan-2 的 Vikram 等）不是着陆点，不收。
// IAU 地名表里找不到名字的任务直接不显示，不会用一个凭记忆的坐标顶上。
import type { LatLon } from "../moon-frames";
import { loadLunarNames } from "../search/lunar-names";

export type LandingSiteKind = "human" | "robotic";
export type LandingFilter = "all" | LandingSiteKind;

export const LANDING_FILTERS: ReadonlyArray<{ id: LandingFilter; label: string }> = [
  { id: "all", label: "All historical sites" },
  { id: "human", label: "Human landing sites" },
  { id: "robotic", label: "Robotic landing sites" },
];

export interface HistoricLandingSite extends LatLon {
  id: string;
  kind: LandingSiteKind;
  mission: string;
  agency: string;
  /** 着陆日期（UTC），YYYY-MM-DD。 */
  landedUtc: string;
  summary: string;
  /** 这个位置的光照/通信特点，配合下面的数据看。 */
  dataNote: string;
  /** 坐标从哪里来（给详情面板显示）。 */
  positionNote: string;
}

type MissionInfo = Omit<HistoricLandingSite, "id" | "latDeg" | "lonDeg" | "positionNote"> & {
  /** IAU 批准的着陆站名；有就用地名表里的坐标。 */
  iauName?: string;
  /** 没有 IAU 名字时用这个：十进制度（由维基百科表里的度分秒换算）。 */
  position?: LatLon;
};

const US = "NASA · United States";
const USSR = "USSR · Soviet Union";
const CNSA = "CNSA · China";

const MISSIONS: MissionInfo[] = [
  // ---- 载人：阿波罗 ----
  {
    kind: "human",
    iauName: "Statio Tranquillitatis",
    mission: "Apollo 11",
    agency: US,
    landedUtc: "1969-07-20",
    summary: "The first crewed landing. Neil Armstrong and Buzz Aldrin spent about 21½ hours on the surface in Mare Tranquillitatis and returned about 21.5 kg of samples.",
    dataNote: "Near the equator on the near side: Earth stays high in the sky all the time, and the Sun is up for about half of every lunar day (about 14¾ Earth days of light, then the same of night).",
  },
  {
    kind: "human",
    position: { latDeg: -3.0125, lonDeg: -23.4217 },
    mission: "Apollo 12",
    agency: US,
    landedUtc: "1969-11-19",
    summary: "The second crewed landing, in Oceanus Procellarum. Pete Conrad and Alan Bean touched down a short walk from the Surveyor 3 probe and brought parts of it back to Earth.",
    dataNote: "Near side, close to the equator: Earth is always high and in direct view; the Sun follows the usual two-week day and night.",
  },
  {
    kind: "human",
    position: { latDeg: -3.6453, lonDeg: -17.4714 },
    mission: "Apollo 14",
    agency: US,
    landedUtc: "1971-02-05",
    summary: "Alan Shepard and Edgar Mitchell landed in the Fra Mauro highlands, the target of the cancelled Apollo 13, and collected about 42 kg of samples.",
    dataNote: "Near-side highlands near the equator: Earth is always in view; ridges and crater rims close by shape the horizon.",
  },
  {
    kind: "human",
    position: { latDeg: 26.1322, lonDeg: 3.6339 },
    mission: "Apollo 15",
    agency: US,
    landedUtc: "1971-07-30",
    summary: "The first mission with the lunar rover. David Scott and James Irwin explored the Hadley–Apennine region, between the Apennine mountains and Hadley Rille.",
    dataNote: "Near side at about 26°N, beside tall mountains: Earth is always in view, but the massifs can hide a low Sun in the morning and evening.",
  },
  {
    kind: "human",
    position: { latDeg: -8.9731, lonDeg: 15.5003 },
    mission: "Apollo 16",
    agency: US,
    landedUtc: "1972-04-21",
    summary: "John Young and Charles Duke explored the Descartes highlands, the only crewed landing in the lunar highlands, and brought back about 95 kg of samples.",
    dataNote: "Near-side highlands just south of the equator: Earth stays in view; rough, rolling ground gives a varied horizon.",
  },
  {
    kind: "human",
    position: { latDeg: 20.1908, lonDeg: 30.7717 },
    mission: "Apollo 17",
    agency: US,
    landedUtc: "1972-12-11",
    summary: "The last crewed landing. Eugene Cernan and Harrison Schmitt, the only geologist to walk on the Moon, worked in the Taurus–Littrow valley and returned about 110 kg of samples.",
    dataNote: "A narrow valley between tall massifs on the near side: Earth is always in view, but the valley walls block the Sun at low angles.",
  },
  // ---- 无人：苏联月球号 ----
  {
    kind: "robotic",
    position: { latDeg: 7.0833, lonDeg: -64.3667 },
    mission: "Luna 9",
    agency: USSR,
    landedUtc: "1966-02-03",
    summary: "The first soft landing on the Moon. It sent back the first photographs from the surface, in Oceanus Procellarum.",
    dataNote: "Western near side: Earth is high and always in view for direct radio contact.",
  },
  {
    kind: "robotic",
    position: { latDeg: 18.8667, lonDeg: -62.05 },
    mission: "Luna 13",
    agency: USSR,
    landedUtc: "1966-12-24",
    summary: "The second Soviet soft lander. It sent panoramic pictures and measured how firm the soil is with a small probe.",
    dataNote: "Western near side, Oceanus Procellarum: Earth is always in view.",
  },
  {
    kind: "robotic",
    position: { latDeg: -0.6833, lonDeg: 56.3 },
    mission: "Luna 16",
    agency: USSR,
    landedUtc: "1970-09-20",
    summary: "The first robotic sample return from the Moon: about 100 g of soil from Mare Fecunditatis came back to Earth.",
    dataNote: "Eastern near side, near the equator: Earth stays in view, though low in the sky near the limb.",
  },
  {
    kind: "robotic",
    position: { latDeg: 38.2833, lonDeg: -35.0 },
    mission: "Luna 17 · Lunokhod 1",
    agency: USSR,
    landedUtc: "1970-11-17",
    summary: "Delivered Lunokhod 1, the first remote-controlled rover on another world, to Mare Imbrium. It drove about 10 km.",
    dataNote: "Mid-northern near side: Earth is always in view; the Sun is low for part of every day at this latitude.",
  },
  {
    kind: "robotic",
    position: { latDeg: 3.5667, lonDeg: 56.5 },
    mission: "Luna 20",
    agency: USSR,
    landedUtc: "1972-02-21",
    summary: "A sample-return mission to the highlands north of Mare Fecunditatis that brought back about 55 g of soil.",
    dataNote: "Eastern near side near the equator: Earth is in view but low towards the limb.",
  },
  {
    kind: "robotic",
    position: { latDeg: 25.85, lonDeg: 30.45 },
    mission: "Luna 21 · Lunokhod 2",
    agency: USSR,
    landedUtc: "1973-01-15",
    summary: "Delivered Lunokhod 2 to Le Monnier crater at the edge of Mare Serenitatis. It drove about 39 km, the longest drive on the Moon for decades.",
    dataNote: "Near side at about 26°N, close to the Apollo 17 valley: Earth is always in view.",
  },
  {
    kind: "robotic",
    position: { latDeg: 12.75, lonDeg: 62.2 },
    mission: "Luna 24",
    agency: USSR,
    landedUtc: "1976-08-18",
    summary: "The last Soviet lunar mission. It drilled about 2 m into Mare Crisium and returned about 170 g of soil.",
    dataNote: "Eastern edge of the near side: Earth is in view but only a few degrees above the horizon, so a hill can hide it.",
  },
  // ---- 无人：美国勘测者 ----
  {
    kind: "robotic",
    position: { latDeg: -2.4739, lonDeg: -43.3389 },
    mission: "Surveyor 1",
    agency: US,
    landedUtc: "1966-06-02",
    summary: "NASA's first soft landing, in Oceanus Procellarum. It sent back more than 11,000 pictures.",
    dataNote: "Western near side near the equator: Earth is high and always in direct view.",
  },
  {
    kind: "robotic",
    position: { latDeg: -3.015, lonDeg: -23.4181 },
    mission: "Surveyor 3",
    agency: US,
    landedUtc: "1967-04-20",
    summary: "Dug trenches in the soil with a scoop. The Apollo 12 crew later landed beside it and took parts of it home.",
    dataNote: "Near side close to the equator: Earth is always in view.",
  },
  {
    kind: "robotic",
    position: { latDeg: 1.4611, lonDeg: 23.195 },
    mission: "Surveyor 5",
    agency: US,
    landedUtc: "1967-09-11",
    summary: "Made the first chemical analysis of lunar soil, in Mare Tranquillitatis, not far from where Apollo 11 would land.",
    dataNote: "Near side on the equator: Earth is high in the sky; the Sun is up for about half of each lunar day.",
  },
  {
    kind: "robotic",
    position: { latDeg: 0.4742, lonDeg: -1.4275 },
    mission: "Surveyor 6",
    agency: US,
    landedUtc: "1967-11-10",
    summary: "Made the first liftoff from the Moon: it fired its engines and hopped about 2.5 m to a new spot.",
    dataNote: "Centre of the near side: Earth is almost straight overhead.",
  },
  {
    kind: "robotic",
    position: { latDeg: -40.98, lonDeg: -11.5139 },
    mission: "Surveyor 7",
    agency: US,
    landedUtc: "1968-01-10",
    summary: "The last Surveyor landed in the highlands north of Tycho crater and analysed highland soil and rocks.",
    dataNote: "Southern near side at about 41°S: Earth is in view but lower; the Sun stays lower in the sky.",
  },
  // ---- 无人：中国、印度、日本、美国商业 ----
  {
    kind: "robotic",
    iauName: "Guang Han Gong",
    mission: "Chang'e 3",
    agency: CNSA,
    landedUtc: "2013-12-14",
    summary: "China's first lunar landing and the first soft landing on the Moon since 1976, in northern Mare Imbrium. It carried the Yutu rover.",
    dataNote: "Mid-latitude near side: Earth is always in view for direct radio contact, but the lander still has to survive two-week nights.",
  },
  {
    kind: "robotic",
    iauName: "Statio Tianhe",
    mission: "Chang'e 4",
    agency: CNSA,
    landedUtc: "2019-01-03",
    summary: "The first soft landing on the far side, in Von Kármán crater inside the South Pole–Aitken basin, with the Yutu-2 rover.",
    dataNote: "Far side: Earth never rises here, so every message went through the Queqiao relay satellite. Compare its Earth-in-view value with Apollo 11.",
  },
  {
    kind: "robotic",
    iauName: "Statio Tianchuan",
    mission: "Chang'e 5",
    agency: CNSA,
    landedUtc: "2020-12-01",
    summary: "A sample-return mission to Oceanus Procellarum near Mons Rümker. It brought about 1.7 kg of young volcanic rock back to Earth.",
    dataNote: "Near side with direct Earth contact; the surface work was planned to finish within one lunar daytime.",
  },
  {
    kind: "robotic",
    iauName: "Statio Shiv Shakti",
    mission: "Chandrayaan-3",
    agency: "ISRO · India",
    landedUtc: "2023-08-23",
    summary: "India's first soft landing: the Vikram lander and Pragyan rover, the first to land this far south (about 69°S).",
    dataNote: "High southern latitude: the Sun stays low, so shadows are long and slopes matter. The mission was designed for one lunar daytime.",
  },
  {
    kind: "robotic",
    position: { latDeg: -13.3161, lonDeg: 25.2511 },
    mission: "SLIM",
    agency: "JAXA · Japan",
    landedUtc: "2024-01-19",
    summary: "Japan's first Moon landing, a precision touchdown near Shioli crater. It came to rest tilted, but kept working and survived a lunar night.",
    dataNote: "Near side south of the equator: Earth is in view; the lander's solar panels faced west, so light mattered more than usual.",
  },
  {
    kind: "robotic",
    iauName: "Statio Tianjiang",
    mission: "Chang'e 6",
    agency: CNSA,
    landedUtc: "2024-06-01",
    summary: "The first samples from the far side (about 1.9 kg), collected in the Apollo basin inside the South Pole–Aitken basin.",
    dataNote: "Far side: no direct line of sight to Earth, so it relied on the Queqiao-2 relay satellite.",
  },
  {
    kind: "robotic",
    position: { latDeg: 18.5622, lonDeg: 61.8103 },
    mission: "Blue Ghost Mission 1",
    agency: "Firefly Aerospace · United States",
    landedUtc: "2025-03-02",
    summary: "The first fully successful commercial Moon landing, in Mare Crisium. It worked for about a lunar day, carrying NASA science instruments.",
    dataNote: "Eastern near side: Earth is in view but low in the sky; the mission planned for roughly 14 Earth days of daylight.",
  },
];

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** 着陆点清单（按着陆日期排序）。IAU 有名字的用地名表里的坐标，其余用维基百科表里的坐标。 */
export async function loadHistoricLandingSites(): Promise<HistoricLandingSite[]> {
  const names = await loadLunarNames();
  const sites = MISSIONS.flatMap(({ iauName, position, ...mission }): HistoricLandingSite[] => {
    const id = slug(mission.mission);
    if (iauName) {
      const entry = names.find((name) => name.name === iauName);
      return entry ? [{ ...mission, id, latDeg: entry.latDeg, lonDeg: entry.lonDeg, positionNote: `${iauName} · IAU Gazetteer of Planetary Nomenclature` }] : [];
    }
    return position ? [{ ...mission, id, latDeg: position.latDeg, lonDeg: position.lonDeg, positionNote: "Position: Wikipedia list of artificial objects on the Moon (NASA/LROC and agency sources), to be double-checked" }] : [];
  });
  return sites.sort((a, b) => a.landedUtc.localeCompare(b.landedUtc));
}

export function filterLandingSites(sites: readonly HistoricLandingSite[], filter: LandingFilter): HistoricLandingSite[] {
  return filter === "all" ? [...sites] : sites.filter((site) => site.kind === filter);
}
