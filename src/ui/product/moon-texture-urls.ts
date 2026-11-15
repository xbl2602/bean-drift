// 产品页贴图的地址，以及"进地图要先下哪几张"。
// 故意不 import three：首页的预载组件也要用这里，不能把 three 拖进首页的包里。
// 贴图由 src/ui/product/data-build/ 里的脚本生成，约定写在 public/product/moon/moon-meta.json。
//
// 分级原则（决定见 docs/decisions/2026-11-15_xbl2602_product-on-demand-rendering.md）：画面需要多细就下多细。
//   - 彩色底图：单文件 4K 当底（1.2 MB，默认视图够用），放大后按需下 512 像素的瓦片（8K、16K 两级）；
//   - 数据贴图（法线、高度、坡度、极区光照）：先 2K，真要用到细节再换 4K（它们的原始数据本来就只有 5760 宽，没有更细的了）；
//   - 天空里的地球和太阳在屏幕上只有一百来像素，直接用小图。

export const MOON_ASSET_BASE = "/product/moon";
export const SKY_ASSET_BASE = "/product/sky";

/** 4K 版（完整精度）。极区光照图 4K 版还给 CPU 读单点数值用（analysis/polar-light.ts）。 */
export const MOON_TEXTURES = {
  color4k: `${MOON_ASSET_BASE}/color-4k.jpg`,
  relief: `${MOON_ASSET_BASE}/relief-4k.png`,
  normal: `${MOON_ASSET_BASE}/normal-4k.jpg`,
  slope: `${MOON_ASSET_BASE}/slope-4k.jpg`,
  /** 极区光照预计算，通道含义见 public/product/moon/polar-light-meta.json。 */
  polar: `${MOON_ASSET_BASE}/polar-light-4k.png`,
} as const;

/** 数据贴图的 2K 粗版本，体积约为 4K 的 1/4 到 1/3。 */
export const COARSE_TEXTURES = {
  relief: `${MOON_ASSET_BASE}/relief-2k.png`,
  normal: `${MOON_ASSET_BASE}/normal-2k.jpg`,
  slope: `${MOON_ASSET_BASE}/slope-2k.jpg`,
  polar: `${MOON_ASSET_BASE}/polar-light-2k.png`,
} as const;

export type DataMapKey = keyof typeof COARSE_TEXTURES;

export const SKY_TEXTURES = {
  earth: `${SKY_ASSET_BASE}/earth-2k.jpg`,
  sun: `${SKY_ASSET_BASE}/sun-sdo-1k.jpg`,
} as const;

/** 彩色底图瓦片。level n 整张宽 tilePx * 2^(n+1)、高 tilePx * 2^n；level 2（4096 宽）以下就是单文件 color-4k.jpg，不切。 */
export const COLOR_TILES = {
  tilePx: 512,
  levels: [3, 4] as const,
  urlFor: (level: number, row: number, col: number) => `${MOON_ASSET_BASE}/color-tiles/${level}/${row}-${col}.jpg`,
};

/**
 * 进 2D 地图必须先到的那几张（默认视图只用到底图和法线）。到齐就撤掉遮罩，其余的在后台补。
 * 首页空闲时预载的也是这几张。
 */
export const ENTRY_TEXTURE_URLS: readonly string[] = [MOON_TEXTURES.color4k, COARSE_TEXTURES.normal];

/** 切到分析图层或 3D 时马上会用到的粗版本和天空小图，进地图后接着悄悄下。 */
export const WARM_TEXTURE_URLS: readonly string[] = [COARSE_TEXTURES.relief, COARSE_TEXTURES.slope, COARSE_TEXTURES.polar, SKY_TEXTURES.earth, SKY_TEXTURES.sun];

/** 网络好时在首页再多下的细版本（4K 法线）：放大看地形阴影用。 */
export const FINE_TEXTURE_URLS: readonly string[] = [MOON_TEXTURES.normal];
