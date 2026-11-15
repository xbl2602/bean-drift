// "Landing Sites" 模式里的真实着陆点。
// 坐标不在这里手写：从 IAU 官方月面地名表（已登记在 docs/CREDITS.md）里按名字取 "Statio"（着陆站）条目，
// 这些名字是 IAU 专门给着陆点批准的。这里只写每个任务的简短说明（公开任务资料）。
// 地名表里找不到的任务（比如名字改了）直接不显示，不会用一个凭记忆的坐标顶上。
import type { LatLon } from "../moon-frames";
import { loadLunarNames } from "../search/lunar-names";

export interface HistoricLandingSite extends LatLon {
  id: string;
  /** IAU 批准的着陆站名。 */
  iauName: string;
  mission: string;
  agency: string;
  /** 着陆日期（UTC），YYYY-MM-DD。 */
  landedUtc: string;
  summary: string;
  /** 这个位置的光照/通信特点，配合下面的数据看。 */
  dataNote: string;
}

type MissionInfo = Omit<HistoricLandingSite, "id" | "latDeg" | "lonDeg">;

const MISSIONS: MissionInfo[] = [
  {
    iauName: "Statio Tranquillitatis",
    mission: "Apollo 11",
    agency: "NASA · United States",
    landedUtc: "1969-07-20",
    summary: "The first crewed landing. Neil Armstrong and Buzz Aldrin spent about 21½ hours on the surface in Mare Tranquillitatis and returned about 21.5 kg of samples.",
    dataNote: "Near the equator on the near side: Earth stays high in the sky all the time, and the Sun is up for about half of every lunar day (about 14¾ Earth days of light, then the same of night).",
  },
  {
    iauName: "Guang Han Gong",
    mission: "Chang'e 3",
    agency: "CNSA · China",
    landedUtc: "2013-12-14",
    summary: "China's first lunar landing and the first soft landing on the Moon since 1976, in northern Mare Imbrium. It carried the Yutu rover.",
    dataNote: "Mid-latitude near side: Earth is always in view for direct radio contact, but the lander still has to survive two-week nights.",
  },
  {
    iauName: "Statio Tianhe",
    mission: "Chang'e 4",
    agency: "CNSA · China",
    landedUtc: "2019-01-03",
    summary: "The first soft landing on the far side, in Von Kármán crater inside the South Pole–Aitken basin, with the Yutu-2 rover.",
    dataNote: "Far side: Earth never rises here, so every message went through the Queqiao relay satellite. Compare its Earth-in-view value with Apollo 11.",
  },
  {
    iauName: "Statio Tianchuan",
    mission: "Chang'e 5",
    agency: "CNSA · China",
    landedUtc: "2020-12-01",
    summary: "A sample-return mission to Oceanus Procellarum near Mons Rümker. It brought about 1.7 kg of young volcanic rock back to Earth.",
    dataNote: "Near side with direct Earth contact; the surface work was planned to finish within one lunar daytime.",
  },
  {
    iauName: "Statio Shiv Shakti",
    mission: "Chandrayaan-3",
    agency: "ISRO · India",
    landedUtc: "2023-08-23",
    summary: "India's first soft landing: the Vikram lander and Pragyan rover, the first to land this far south (about 69°S).",
    dataNote: "High southern latitude: the Sun stays low, so shadows are long and slopes matter. The mission was designed for one lunar daytime.",
  },
  {
    iauName: "Statio Tianjiang",
    mission: "Chang'e 6",
    agency: "CNSA · China",
    landedUtc: "2024-06-01",
    summary: "The first samples from the far side (about 1.9 kg), collected in the Apollo basin inside the South Pole–Aitken basin.",
    dataNote: "Far side: no direct line of sight to Earth, so it relied on the Queqiao-2 relay satellite.",
  },
];

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** 着陆点清单（按着陆日期排序），坐标来自 IAU 地名表。 */
export async function loadHistoricLandingSites(): Promise<HistoricLandingSite[]> {
  const names = await loadLunarNames();
  return MISSIONS.flatMap((mission) => {
    const entry = names.find((name) => name.name === mission.iauName);
    return entry ? [{ ...mission, id: slug(mission.mission), latDeg: entry.latDeg, lonDeg: entry.lonDeg }] : [];
  });
}
