// 把下载好的图片文件变成 three 贴图。
// 用 createImageBitmap 解码：解码在浏览器的后台线程做，不会让页面卡住（4K 图在慢 CPU 上用普通 Image 解码会卡几百毫秒）。
// 浏览器不支持时退回 TextureLoader（会占主线程，但能用）。
import * as THREE from "three";

/**
 * colorData=true 表示它是给人看的颜色（sRGB），false 表示是数据（法线、高度）或要按原值输出的颜色。
 * 数据贴图不允许浏览器做任何颜色转换，否则数值会变。
 */
export async function decodeTexture(blob: Blob, colorData: boolean, anisotropy: number): Promise<THREE.Texture> {
  let texture: THREE.Texture;
  if (typeof createImageBitmap === "function") {
    // ImageBitmap 不吃 three 的 flipY 设置，翻转要在解码时做
    const bitmap = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: colorData ? "default" : "none" });
    texture = new THREE.Texture(bitmap);
    texture.flipY = false;
  } else {
    const objectUrl = URL.createObjectURL(blob);
    try {
      texture = await new THREE.TextureLoader().loadAsync(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  texture.colorSpace = colorData ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}
