// 产品页贴图的地址，以及"进地图要先下哪几张"。
// 故意不 import three：首页的预载组件也要用这里，不能把 three 拖进首页的包里。
// 贴图由 src/ui/product/data-build/build-moon-textures.mjs 生成，约定写在 public/product/moon/moon-meta.json。

export const MOON_ASSET_BASE = "/product/moon";

export const MOON_TEXTURES = {
  color8k: `${MOON_ASSET_BASE}/color-8k.jpg`,
  color4k: `${MOON_ASSET_BASE}/color-4k.jpg`,
  relief: `${MOON_ASSET_BASE}/relief-4k.png`,
  normal: `${MOON_ASSET_BASE}/normal-4k.jpg`,
  slope: `${MOON_ASSET_BASE}/slope-4k.jpg`,
  /** 极区光照预计算，通道含义见 public/product/moon/polar-light-meta.json。 */
  polar: `${MOON_ASSET_BASE}/polar-light-4k.png`,
} as const;

/**
 * 底图（彩色影像）用哪一张。
 * 8K 在屏幕上直到约 4 倍放大都和 16K 看不出区别（评估见 docs/decisions/2026-11-14_xbl2602_product-page-load-speed.md），
 * 再近由 NASA Moon Trek 瓦片接手，所以不用 16K（那张 41.7 MB，是进地图时最大的一块）。
 * 显卡的最大贴图边长不到 8192（手机常见）就退到 4K。
 */
export function colorTextureUrlFor(maxTextureSize: number): string {
  return maxTextureSize >= 8192 ? MOON_TEXTURES.color8k : MOON_TEXTURES.color4k;
}

/** 进 2D 地图时要一起下的 5 张贴图（2D 地图和 3D 球用的是同一批）。 */
export function entryTextureUrls(maxTextureSize: number): string[] {
  return [colorTextureUrlFor(maxTextureSize), MOON_TEXTURES.relief, MOON_TEXTURES.slope, MOON_TEXTURES.normal, MOON_TEXTURES.polar];
}
