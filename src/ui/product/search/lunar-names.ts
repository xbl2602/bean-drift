// 地点搜索：IAU 月面地名（约 9000 条，按需下载一次）+ 直接输入经纬度。
import { LUNAR_NAMES_URL } from "../moon-assets";
import type { LatLon } from "../moon-frames";

export interface LunarName extends LatLon {
  name: string;
  featureType: string;
  diameterKm: number;
  /** 去掉重音符号、转小写后的名字，用来匹配。 */
  key: string;
}

/** 去掉重音符号并转小写："Mare Frigoris" 和 "mare frigoris"、"Schrödinger" 和 "schrodinger" 都能对上。 */
const foldText = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

let namesPromise: Promise<LunarName[]> | null = null;

export function loadLunarNames(): Promise<LunarName[]> {
  namesPromise ??= fetch(LUNAR_NAMES_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`lunar names returned ${response.status}`);
      return response.json() as Promise<{ names: Array<[string, string, number, number, number]> }>;
    })
    .then((file) => file.names.map(([name, featureType, latDeg, lonDeg, diameterKm]) => ({ name, featureType, latDeg, lonDeg, diameterKm, key: foldText(name) })));
  namesPromise.catch(() => {
    namesPromise = null; // 下次再试
  });
  return namesPromise;
}

/** 人们常在名字后面加的普通词（IAU 官方名里没有这些词），以及它们对应的地物类型。 */
const EVERYDAY_TYPE_WORDS: Record<string, string> = { crater: "Crater", massif: "Mons", mountain: "Mons", mount: "Mons", peak: "Mons", valley: "Vallis", sea: "Mare", bay: "Sinus", lake: "Lacus" };

/**
 * 按名字搜索。"Shackleton Crater"、"Malapert Massif" 这类写法里的 crater / massif 不是官方名的一部分：
 * 先把这些词去掉再匹配，并把对应类型的地物排到最前（Malapert Massif -> Mons Malapert，而不是 Malapert 环形山）。
 * 排序：类型相符 > 名字完全相同 > 名字以查询开头 > 名字里含有查询；同一档里保持文件顺序（大的地物在前）。
 */
export function searchLunarNames(names: LunarName[], query: string, limit: number): LunarName[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  const preferredType = words.map((word) => EVERYDAY_TYPE_WORDS[word]).find(Boolean);
  const q = words.filter((word) => !EVERYDAY_TYPE_WORDS[word]).join(" ");
  if (q.length < 2) return [];
  const ranked: Array<{ entry: LunarName; rank: number }> = [];
  for (const entry of names) {
    const position = entry.key.indexOf(q);
    if (position < 0) continue;
    // 查询是不是名字里完整的词（"tycho" 对 "tycho a" 算，对 "tychonis" 不算）
    const wholeWord = ` ${entry.key} `.includes(` ${q} `);
    let rank = entry.key === q ? 0 : position === 0 ? 2 : 4;
    if (preferredType && entry.featureType === preferredType && wholeWord) rank = -2;
    else if (wholeWord && entry.featureType !== "Satellite Feature") rank -= 1;
    ranked.push({ entry, rank });
  }
  return ranked.sort((x, y) => x.rank - y.rank).slice(0, limit).map(({ entry }) => entry);
}

/**
 * 解析手输的经纬度，纬度在前。支持 "-89.67, 129.78"、"89.67S 129.78E"、"0.674 N, 23.473 E"、东经 0..360。
 * 不像坐标或超出范围时返回 null。
 */
export function parseCoordinates(text: string): LatLon | null {
  const match = text.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,;]+([+-]?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!match) return null;
  let latDeg = Number(match[1]);
  let lonDeg = Number(match[3]);
  if (match[2]?.toUpperCase() === "S") latDeg = -Math.abs(latDeg);
  if (match[4]?.toUpperCase() === "W") lonDeg = -Math.abs(lonDeg);
  if (Math.abs(latDeg) > 90 || lonDeg < -180 || lonDeg > 360) return null;
  return { latDeg, lonDeg: lonDeg > 180 ? lonDeg - 360 : lonDeg };
}

/** 定位到某个地物时，画面里显示多大范围（度）：大约是地物直径的 4 倍，最小 12°（再近贴图就糊了，也看不到周围环境）。 */
export function viewSpanDegFor(diameterKm: number): number {
  const diameterDeg = (diameterKm / 1737.4) * (180 / Math.PI);
  return Math.min(Math.max(diameterDeg * 4, 12), 120);
}
