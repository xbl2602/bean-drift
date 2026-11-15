// 左上角工具清单。以后加工具：在这里加一项，再在 panels/tool-panel.tsx 里接上对应的面板。
import type { BaseLayer } from "../map-layers";

export type ToolId = "tutorial" | "settings" | "ai" | "search" | "site" | "measure" | "elevation" | "illumination" | "temperature" | "ice" | "slope" | "suitability" | "compare" | "export";

/** 菜单里的分组。top = 顶部模式条右边的按钮（AI 工具、教程、设置），不在左边工具栏里。 */
export type ToolCategory = "top" | "explore" | "science" | "evaluate";

/** 设置按钮的齿轮图标：8 个齿，外圈半径 9.5，齿根 7，中间一个小圆孔。 */
const GEAR_ICON = (() => {
  const point = (angleDeg: number, radius: number) => `${(12 + radius * Math.cos((angleDeg * Math.PI) / 180)).toFixed(2)} ${(12 + radius * Math.sin((angleDeg * Math.PI) / 180)).toFixed(2)}`;
  const corners: string[] = [];
  for (let tooth = 0; tooth < 8; tooth++) {
    const centre = tooth * 45;
    corners.push(point(centre - 17, 7), point(centre - 10, 9.5), point(centre + 10, 9.5), point(centre + 17, 7));
  }
  return `M${corners.join("L")}ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z`;
})();

/** 英文原文（无障碍标签的后备）。界面上显示的文字走翻译：i18n/messages-*.ts 的 category.* / tool.*。 */
export const CATEGORY_LABELS: Record<Exclude<ToolCategory, "top">, string> = {
  explore: "Map Exploration",
  science: "Scientific Data",
  evaluate: "Site Evaluation",
};

export interface ToolInfo {
  id: ToolId;
  category: ToolCategory;
  label: string;
  hint: string;
  /** 24×24 的线条图标路径。 */
  icon: string;
  /** 选中这个工具时地图切到哪个图层；不写就保持当前图层。 */
  layer?: BaseLayer;
  /** 这个工具打开时，点击地图做什么（默认：进入第一人称）。 */
  clickMode?: "drop-site" | "measure";
}

export const TOOLS: ToolInfo[] = [
  { id: "tutorial", category: "top", label: "Tutorial", hint: "A short guided tour of every part of the site", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 13v.01M12 13a2.5 2.5 0 1 0-2.5-2.5" },
  { id: "settings", category: "top", label: "Settings", hint: "Appearance, language and information about this site", icon: GEAR_ICON },
  { id: "ai", category: "top", label: "AI Tools", hint: "Ask questions about the Moon in everyday words", icon: "M12 3l1.8 4.7L18.5 9.5l-4.700 1.800L12 16l-1.800-4.700L5.500 9.500l4.700-1.800L12 3Zm6.500 11 .900 2.100 2.100.900-2.100.900-.900 2.100-.900-2.100-2.100-.900 2.100-.900.900-2.100Z" },
  { id: "search", category: "explore", label: "Search Location", hint: "Jump to a crater, landing site or coordinates", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3" },
  { id: "site", category: "explore", label: "Select Landing Site", hint: "Drop a pin, see its data and save it as a candidate", icon: "M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.800-6 11-6 11Zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", clickMode: "drop-site" },
  { id: "measure", category: "explore", label: "Measure Distance", hint: "Click points to see how far apart they are", icon: "M3 17 17 3l4 4L7 21l-4-4Zm5-5 2 2m1-5 2 2m1-5 2 2", clickMode: "measure" },
  { id: "elevation", category: "science", label: "Terrain & Elevation", hint: "Colour the map by height: high ground vs. low basins", icon: "M3 19 9 8l4 6 3-4 5 9H3Z", layer: "elevation" },
  { id: "illumination", category: "science", label: "Solar Illumination", hint: "See which places get the most sunlight (power)", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.600 5.600 7 7m10 10 1.400 1.400M5.600 18.400 7 17M17 7l1.400-1.400", layer: "illumination" },
  { id: "temperature", category: "science", label: "Temperature", hint: "See how hot or cold each place gets", icon: "M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Zm2 1v3", layer: "temperature" },
  { id: "ice", category: "science", label: "Water Ice Potential", hint: "Spot cold, shadowed places where water ice may hide", icon: "M12 2v20M4 6l16 12M20 6 4 18M9 4l3 3 3-3M9 20l3-3 3 3", layer: "ice" },
  { id: "slope", category: "science", label: "Surface Slope", hint: "See where the ground is flat enough to land", icon: "M3 20h18L21 6 3 20Zm11-4.500V20", layer: "slope" },
  { id: "suitability", category: "evaluate", label: "Site Suitability", hint: "Score every place by the things you care about", icon: "m12 3 2.700 5.600 6.100.900-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.900L12 3Z", layer: "suitability" },
  { id: "compare", category: "evaluate", label: "Compare Landing Sites", hint: "Put selected sites side by side", icon: "M5 20V10m7 10V4m7 16v-7" },
  { id: "export", category: "evaluate", label: "Export Results", hint: "Download your sites and results as a file", icon: "M12 4v11m0 0-4-4m4 4 4-4M5 19h14" },
];

export const toolInfo = (id: ToolId): ToolInfo => TOOLS.find((tool) => tool.id === id)!;
