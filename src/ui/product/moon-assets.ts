// 产品页用到的月球贴图地址与常量。贴图由 src/ui/product/data-build/build-moon-textures.mjs 生成，
// 约定写在 public/product/moon/moon-meta.json；这里的数字必须和那份文件一致。
import * as THREE from "three";

const BASE = "/product/moon";

export const MOON_TEXTURES = {
  color16k: `${BASE}/color-16k.jpg`,
  color8k: `${BASE}/color-8k.jpg`,
  color4k: `${BASE}/color-4k.jpg`,
  relief: `${BASE}/relief-4k.png`,
  normal: `${BASE}/normal-4k.jpg`,
  slope: `${BASE}/slope-4k.jpg`,
  /** 极区光照预计算，通道含义见 public/product/moon/polar-light-meta.json。 */
  polar: `${BASE}/polar-light-4k.png`,
} as const;

/** IAU 月面地名表（约 9000 条），格式见 data-build/build-lunar-names.mjs。 */
export const LUNAR_NAMES_URL = `${BASE}/lunar-names.json`;

export const POLAR_LIGHT = {
  widthPx: 4096,
  heightPx: 2048,
  /** 只有南北纬这个度数以上有数据。 */
  minAbsLatDeg: 80,
  decodeSunMarginDeg: (r: number) => (r / 255) * 6 - 3,
} as const;

/** relief-4k.png 的 0 和 255 对应的高度（相对 1737.4 km 参考球）。 */
export const RELIEF_MIN_HEIGHT_M = -8982;
export const RELIEF_MAX_HEIGHT_M = 10686;
/** slope-4k.jpg 的 255 对应的坡度。 */
export const SLOPE_MAX_DEG = 45;

export const HEIGHT_TILES = {
  urlFor: (row: number, col: number) => `${BASE}/height-tiles/${row}-${col}.png`,
  tileDeg: 10,
  tilePx: 160,
  pixelsPerDeg: 16,
  widthPx: 5760,
  heightPx: 2880,
  /** heightM = ((R << 8) | G) / 2 - 10000 */
  decodeHeightM: (r: number, g: number) => ((r << 8) | g) / 2 - 10000,
};

export const MOON_RADIUS_M = 1737400;

/** 加载一张贴图；colorData=true 表示它是给人看的颜色（sRGB），false 表示是数据（法线、高度）。 */
export async function loadMoonTexture(url: string, colorData: boolean): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.colorSpace = colorData ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Select genuine 16K imagery where supported, with 8K and 4K hardware fallbacks. */
export function pickColorTextureUrl(renderer: THREE.WebGLRenderer): string {
  if (renderer.capabilities.maxTextureSize >= 16384) return MOON_TEXTURES.color16k;
  return renderer.capabilities.maxTextureSize >= 8192 ? MOON_TEXTURES.color8k : MOON_TEXTURES.color4k;
}
