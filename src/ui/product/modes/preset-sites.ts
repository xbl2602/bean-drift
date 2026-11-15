// "Landing Sites" 模式里的点位：读后端的 /api/presets，和 API、MCP、AI 窗口用同一份清单。
// 坐标和出处都在 src/core/data/presets.ts，这里不手写任何坐标。
// 这里只保留"讲解文字"：有故事的几个任务（下面的 MISSION_NOTES）写了更详细的介绍，其他点位直接用接口给的 description。
import type { Preset, PresetKind } from "@/core/types";
import { normalizeLonDeg, type LatLon } from "../moon-frames";

export interface SiteEntry extends LatLon {
  /** 和 /api/presets 里的 id 一致。 */
  id: string;
  kind: PresetKind;
  /** 列表里显示的短名字。 */
  label: string;
  /** 接口里的完整名字。 */
  name: string;
  summary: string;
  /** 这个坐标是哪来的（接口里的 positionSource）。 */
  positionSource: string;
  /** 以下三项只有写了详细介绍的任务才有。 */
  agency?: string;
  /** 着陆日期（UTC），YYYY-MM-DD。 */
  landedUtc?: string;
  /** 这个位置的光照/通信特点，配合下面的数据看。 */
  dataNote?: string;
}

interface MissionNotes {
  label: string;
  agency: string;
  landedUtc: string;
  summary: string;
  dataNote: string;
}

/** 键是 /api/presets 里的 id。找不到对应预设的任务不会显示（不会用凭记忆的坐标顶上）。 */
const MISSION_NOTES: Record<string, MissionNotes> = {
  "apollo-11": {
    label: "Apollo 11",
    agency: "NASA · United States",
    landedUtc: "1969-07-20",
    summary: "The first crewed landing. Neil Armstrong and Buzz Aldrin spent about 21½ hours on the surface in Mare Tranquillitatis and returned about 21.5 kg of samples.",
    dataNote: "Near the equator on the near side: Earth stays high in the sky all the time, and the Sun is up for about half of every lunar day (about 14¾ Earth days of light, then the same of night).",
  },
  "chang-e-3": {
    label: "Chang'e 3",
    agency: "CNSA · China",
    landedUtc: "2013-12-14",
    summary: "China's first lunar landing and the first soft landing on the Moon since 1976, in northern Mare Imbrium. It carried the Yutu rover.",
    dataNote: "Mid-latitude near side: Earth is always in view for direct radio contact, but the lander still has to survive two-week nights.",
  },
  "chang-e-4": {
    label: "Chang'e 4",
    agency: "CNSA · China",
    landedUtc: "2019-01-03",
    summary: "The first soft landing on the far side, in Von Kármán crater inside the South Pole–Aitken basin, with the Yutu-2 rover.",
    dataNote: "Far side: Earth never rises here, so every message went through the Queqiao relay satellite. Compare its Earth-in-view value with Apollo 11.",
  },
  "chang-e-5": {
    label: "Chang'e 5",
    agency: "CNSA · China",
    landedUtc: "2020-12-01",
    summary: "A sample-return mission to Oceanus Procellarum near Mons Rümker. It brought about 1.7 kg of young volcanic rock back to Earth.",
    dataNote: "Near side with direct Earth contact; the surface work was planned to finish within one lunar daytime.",
  },
  "chandrayaan-3": {
    label: "Chandrayaan-3",
    agency: "ISRO · India",
    landedUtc: "2023-08-23",
    summary: "India's first soft landing: the Vikram lander and Pragyan rover, the first to land this far south (about 69°S).",
    dataNote: "High southern latitude: the Sun stays low, so shadows are long and slopes matter. The mission was designed for one lunar daytime.",
  },
  "chang-e-6": {
    label: "Chang'e 6",
    agency: "CNSA · China",
    landedUtc: "2024-06-01",
    summary: "The first samples from the far side (about 1.9 kg), collected in the Apollo basin inside the South Pole–Aitken basin.",
    dataNote: "Far side: no direct line of sight to Earth, so it relied on the Queqiao-2 relay satellite.",
  },
};

function toSiteEntry(preset: Preset): SiteEntry {
  const notes = MISSION_NOTES[preset.id];
  return {
    id: preset.id,
    kind: preset.kind,
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

/** 取预设点位清单。失败（网络、接口出错）就抛错，由调用方显示"加载失败"。 */
export async function loadPresetSites(): Promise<SiteEntry[]> {
  const response = await fetch("/api/presets");
  if (!response.ok) throw new Error(`/api/presets returned ${response.status}`);
  const body: { presets?: Preset[] } = await response.json();
  if (!Array.isArray(body.presets)) throw new Error("/api/presets returned no presets");
  return body.presets.map(toSiteEntry);
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
