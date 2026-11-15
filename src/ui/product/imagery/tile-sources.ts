// 两个瓦片来源：
//   1. 我们自己的彩色底图瓦片（public/product/moon/color-tiles，由 16K 彩图切成 512 像素的 8K、16K 两级）：
//      放大到比 4K 底图不够用时开始接手；
//   2. NASA Moon Trek 的 LRO WAC 全月镶嵌瓦片（外部服务）：放得更大时再盖上去。仅用于显示，不用于分析。
// 两者都按"整张月面此刻在屏幕上有多宽"（worldWidthPx）决定用哪一级、什么时候开始用。
import { COLOR_TILES } from "../moon-texture-urls";
import { tileAtlasGlsl, type TileAtlas, type TileSource } from "./tile-atlas";

/** 4K 底图在整张图宽度不超过这个值时就够清楚（留 20% 余量）；超过才开始用 8K 瓦片。 */
const BASE_SUFFICIENT_WIDTH_PX = 4096 * 1.2;
/** 8K 瓦片够用的上限，再宽就用 16K 瓦片。 */
const LEVEL_3_SUFFICIENT_WIDTH_PX = 8192 * 1.2;

export const COLOR_PYRAMID_SOURCE: TileSource = {
  tilePx: COLOR_TILES.tilePx,
  urlFor: COLOR_TILES.urlFor,
  levelFor: (worldWidthPx) => (worldWidthPx <= BASE_SUFFICIENT_WIDTH_PX ? null : worldWidthPx <= LEVEL_3_SUFFICIENT_WIDTH_PX ? 3 : 4),
  minLevel: COLOR_TILES.levels[0],
  maxLevel: COLOR_TILES.levels[COLOR_TILES.levels.length - 1],
  opacityFor: () => 1,
  // 显存里常驻 10×8 个 512 像素格子（约 84 MB），只在放大到需要瓦片时才分配；窗口放不进就降一级
  slotsX: 10,
  slotsY: 8,
  maxTilesPerAxis: 10,
  // 位图只用来"被顶掉的瓦片再看回来时免重下"，已经写进显存的不靠它，所以不用留很多（每块约 1 MB）
  cacheTiles: 40,
  fetchTimeoutMs: 15000,
};

const MOON_TREK_BASE = "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm";

export const MOON_TREK_SOURCE: TileSource = {
  statusLabel: "Loading sharper lunar imagery…",
  tilePx: 256,
  urlFor: (level, row, col) => `${MOON_TREK_BASE}/${level}/${row}/${col}.jpg`,
  levelFor: (worldWidthPx) => Math.max(5, Math.ceil(Math.log2(worldWidthPx / 512))),
  // 不用比 16K 底图更粗的瓦片（两极附近会掉到这一级以下）
  minLevel: 6,
  maxLevel: 8,
  opacityFor: (worldWidthPx) => Math.min(Math.max((worldWidthPx - 18000) / 12000, 0), 1),
  // 12×12 个 256 像素格子（约 38 MB）
  slotsX: 12,
  slotsY: 12,
  maxTilesPerAxis: 12,
  cacheTiles: 160,
  fetchTimeoutMs: 15000,
};

// 着色器里的取样函数和 uniform 的对应：Tiles = 我们自己的金字塔，Detail = Moon Trek。
export const TILES_GLSL = tileAtlasGlsl("Tiles", "lunarTiles");
export const DETAIL_GLSL = tileAtlasGlsl("Detail", "lunarDetail");

export interface MoonAtlases {
  tiles: TileAtlas;
  detail: TileAtlas;
}

/** 把两个图集的 uniform 按着色器里的名字摆好，直接展开到材质的 uniforms 里。 */
export function atlasUniforms({ tiles, detail }: MoonAtlases) {
  return {
    uTilesMap: tiles.uniforms.map,
    uTilesBounds: tiles.uniforms.bounds,
    uTilesLayout: tiles.uniforms.layout,
    uTilesOpacity: tiles.uniforms.opacity,
    uDetailMap: detail.uniforms.map,
    uDetailBounds: detail.uniforms.bounds,
    uDetailLayout: detail.uniforms.layout,
    uDetailOpacity: detail.uniforms.opacity,
  };
}
