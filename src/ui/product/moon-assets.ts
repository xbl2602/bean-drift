// 产品页用到的月球贴图地址与常量。贴图由 src/ui/product/data-build/build-moon-textures.mjs 生成，
// 约定写在 public/product/moon/moon-meta.json；这里的数字必须和那份文件一致。
import * as THREE from "three";
import { MOON_ASSET_BASE as BASE, MOON_TEXTURES, colorTextureUrlFor } from "./moon-texture-urls";
import { fetchTextureBlob } from "./preload/texture-blob-cache";

// 贴图地址本身在 moon-texture-urls.ts（不依赖 three，首页预载也要用）；这里重新导出，其他文件照旧从这里取。
export { MOON_TEXTURES };

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

/**
 * 加载一张贴图；colorData=true 表示它是给人看的颜色（sRGB），false 表示是数据（法线、高度）。
 * 文件走 texture-blob-cache：如果首页已经在后台下了（或正在下），这里直接用，不会再发一次请求。
 */
export async function loadMoonTexture(url: string, colorData: boolean): Promise<THREE.Texture> {
  const objectUrl = URL.createObjectURL(await fetchTextureBlob(url));
  let texture: THREE.Texture;
  try {
    texture = await new THREE.TextureLoader().loadAsync(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  texture.colorSpace = colorData ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** 底图用 8K（显卡不支持就退到 4K）。为什么不用 16K，见 moon-texture-urls.ts。 */
export function pickColorTextureUrl(renderer: THREE.WebGLRenderer): string {
  return colorTextureUrlFor(renderer.capabilities.maxTextureSize);
}
