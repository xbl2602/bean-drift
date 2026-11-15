// 产品页"按需加载"用的贴图分级生成脚本（一次性离线运行，不被网页 import）。
//
// 为什么要分级：远看用小图、放大才下大图，进地图时只下"当前画面够用"的那一点点（见 docs/decisions/2026-11-15_xbl2602_product-on-demand-rendering.md）。
// 输入全部是仓库里已有的文件（public/product/ 下），不需要再去下载 NASA 原始文件：
//   moon/color-16k.jpg   16384x8192 彩色底图（来自 NASA SVS CGI Moon Kit，见 build-moon-color-16k.mjs）
//   moon/{normal,slope}-4k.jpg、moon/{relief,polar-light}-4k.png
//   sky/earth-8k.jpg、sky/sun-sdo-4k.jpg
//
// 输出：
//   moon/color-tiles/{level}/{row}-{col}.jpg   彩色底图瓦片，512x512。level 3 = 整张 8192 宽（16x8 块），level 4 = 16384 宽（32x16 块）。
//                                             level 2 及以下不切：直接用单文件 color-4k.jpg 当底（1.2 MB，进地图只下它）。
//   moon/{normal,slope}-2k.jpg、moon/{relief,polar-light}-2k.png   数据贴图的 2K 粗版本（先显示它，4K 后台补上）
//   sky/earth-2k.jpg、sky/sun-sdo-1k.jpg        天空里的地球和太阳只占屏幕上一百来像素，不需要 8K / 4K
//
// 用法（sharp 不是项目依赖，仓库的 node_modules 里有一份 Next 带来的，够用）：
//   node src/ui/product/data-build/build-texture-levels.mjs
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const TILE_PX = 512;
const LEVELS = [3, 4]; // level n：宽 TILE_PX * 2^(n+1)，高 TILE_PX * 2^n
const TILE_JPEG_QUALITY = 86;

const publicDir = fileURLToPath(new URL("../../../../public/product/", import.meta.url));
const moonDir = path.join(publicDir, "moon");
const skyDir = path.join(publicDir, "sky");
const big = { limitInputPixels: false };

async function sizeOf(file) {
  return (await stat(file)).size;
}

async function buildColorTiles() {
  console.log("解码 16K 彩色底图…");
  const source = await sharp(path.join(moonDir, "color-16k.jpg"), big).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: fullW, height: fullH } = source.info;
  if (fullW !== 16384 || fullH !== 8192) throw new Error(`color-16k.jpg 应为 16384x8192，实际 ${fullW}x${fullH}`);

  for (const level of LEVELS) {
    const cols = 2 ** (level + 1);
    const rows = 2 ** level;
    const levelW = cols * TILE_PX;
    const levelH = rows * TILE_PX;
    const pixels =
      levelW === fullW
        ? source.data
        : await sharp(source.data, { raw: { width: fullW, height: fullH, channels: 3 }, ...big }).resize(levelW, levelH, { kernel: "lanczos3" }).raw().toBuffer();
    const dir = path.join(moonDir, "color-tiles", String(level));
    await mkdir(dir, { recursive: true });
    let bytes = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const file = path.join(dir, `${row}-${col}.jpg`);
        await sharp(pixels, { raw: { width: levelW, height: levelH, channels: 3 }, ...big })
          .extract({ left: col * TILE_PX, top: row * TILE_PX, width: TILE_PX, height: TILE_PX })
          .jpeg({ quality: TILE_JPEG_QUALITY, mozjpeg: true })
          .toFile(file);
        bytes += await sizeOf(file);
      }
    }
    console.log(`level ${level}: ${cols}x${rows} 块，共 ${(bytes / 1048576).toFixed(1)} MB，平均 ${(bytes / (cols * rows) / 1024).toFixed(0)} KB/块`);
  }
}

async function buildCoarseDataMaps() {
  const jobs = [
    { from: "normal-4k.jpg", to: "normal-2k.jpg", encode: (s) => s.jpeg({ quality: 92, chromaSubsampling: "4:4:4" }) },
    { from: "slope-4k.jpg", to: "slope-2k.jpg", encode: (s) => s.jpeg({ quality: 92, chromaSubsampling: "4:4:4" }) },
    // 高度图只有一个有用通道：2K 版存成单通道灰度 PNG，体积更小（着色器只读 .r）
    { from: "relief-4k.png", to: "relief-2k.png", encode: (s) => s.extractChannel(0).png({ compressionLevel: 9 }) },
    { from: "polar-light-4k.png", to: "polar-light-2k.png", encode: (s) => s.png({ compressionLevel: 9 }) },
  ];
  for (const job of jobs) {
    const out = path.join(moonDir, job.to);
    await job.encode(sharp(path.join(moonDir, job.from), big).resize(2048, 1024, { kernel: "mitchell" })).toFile(out);
    console.log(`${job.to}: ${((await sizeOf(out)) / 1048576).toFixed(2)} MB`);
  }
}

async function buildSkyThumbnails() {
  const earth = path.join(skyDir, "earth-2k.jpg");
  await sharp(path.join(skyDir, "earth-8k.jpg"), big).resize(2048, 1024, { kernel: "lanczos3" }).jpeg({ quality: 90 }).toFile(earth);
  const sun = path.join(skyDir, "sun-sdo-1k.jpg");
  await sharp(path.join(skyDir, "sun-sdo-4k.jpg"), big).resize(1024, 1024, { kernel: "lanczos3" }).jpeg({ quality: 90 }).toFile(sun);
  console.log(`earth-2k.jpg: ${((await sizeOf(earth)) / 1048576).toFixed(2)} MB，sun-sdo-1k.jpg: ${((await sizeOf(sun)) / 1048576).toFixed(2)} MB`);
}

await buildCoarseDataMaps();
await buildSkyThumbnails();
await buildColorTiles();
console.log("完成。");
