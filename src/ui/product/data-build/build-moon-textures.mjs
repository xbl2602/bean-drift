// Lunar Quest 产品页用的月球贴图生成脚本（一次性离线运行，不被网页 import）。
//
// 输入（NASA SVS "CGI Moon Kit"，https://svs.gsfc.nasa.gov/4720 ，原始文件不进 git）：
//   lroc_color_poles_8k.tif  8192x4096 LROC WAC 彩色拼接图（简单圆柱投影，经度 0 在图中央）
//   ldem_16_uint.tif         5760x2880 LOLA 高程，16 位无符号整数，单位半米，
//                            高度(米) = 值 / 2 - 10000（相对 1737.4 km 参考球；脚本会打印范围自检）
//
// 输出（写到 public/product/moon/）：
//   color-8k.jpg / color-4k.jpg   彩色底图（2D 地图用 8K，3D 球用 4K）
//   relief-4k.png                 8 位灰度高度（3D 位移、"高度"图层）
//   normal-4k.jpg                 切线空间法线（东, 北, 上）→ 实时光照与阴影
//   slope-4k.jpg                  坡度，0..45° 线性映射到 0..255
//   height-tiles/{row}-{col}.png   原分辨率 16 位高度，10° 一块，R(高字节)+G(低字节)，第一人称地形在 CPU 上读取
//   moon-meta.json                上面这些数的约定
//
// 用法（sharp 不是项目依赖，临时装在别处即可）：
//   node build-moon-textures.mjs <color.tif> <ldem_16_uint.tif> <输出目录>
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MOON_RADIUS_M = 1737400;
const HALF_METRE_OFFSET_M = 10000;
const SLOPE_MAX_DEG = 45;
const OUT_W = 4096;
const OUT_H = 2048;
const TILE_DEG = 10;

const [colorPath, demPath, outDir] = process.argv.slice(2);
if (!colorPath || !demPath || !outDir) {
  console.error("usage: node build-moon-textures.mjs <color.tif> <ldem_16_uint.tif> <outDir>");
  process.exit(1);
}
await mkdir(outDir, { recursive: true });
const big = { limitInputPixels: false };

async function writeColorMaps() {
  await sharp(colorPath, big).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(outDir, "color-8k.jpg"));
  await sharp(colorPath, big).resize(OUT_W, OUT_H, { kernel: "lanczos3" }).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(outDir, "color-4k.jpg"));
}

async function readHeightsM() {
  const { data, info } = await sharp(demPath, big).pipelineColourspace("grey16").toColourspace("grey16").raw({ depth: "ushort" }).toBuffer({ resolveWithObject: true });
  const raw = new Uint16Array(data.buffer, data.byteOffset, data.length / 2);
  const heightsM = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) heightsM[i] = raw[i] / 2 - HALF_METRE_OFFSET_M;
  return { raw, heightsM, width: info.width, height: info.height };
}

function minMax(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** 中心差分求东向、北向坡度分量（无量纲 dh/ds）。经度方向首尾相接。 */
function surfaceGradients(heightsM, width, height) {
  const stepRad = Math.PI / height;
  const northStepM = MOON_RADIUS_M * stepRad;
  const gradEast = new Float32Array(width * height);
  const gradNorth = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const latRad = Math.PI / 2 - (y + 0.5) * stepRad;
    const eastStepM = Math.max(MOON_RADIUS_M * Math.cos(latRad) * stepRad, northStepM * 0.02);
    const yN = Math.max(y - 1, 0);
    const yS = Math.min(y + 1, height - 1);
    const dyM = northStepM * (yS - yN);
    for (let x = 0; x < width; x++) {
      const xW = (x - 1 + width) % width;
      const xE = (x + 1) % width;
      const i = y * width + x;
      gradEast[i] = (heightsM[y * width + xE] - heightsM[y * width + xW]) / (2 * eastStepM);
      gradNorth[i] = (heightsM[yN * width + x] - heightsM[yS * width + x]) / dyM;
    }
  }
  return { gradEast, gradNorth };
}

/** relief 要做位移，保留无损 PNG；法线和坡度只是看的，用高质量 JPG 省体积。 */
async function writeResized(pixels, width, height, channels, file) {
  const resized = sharp(pixels, { raw: { width, height, channels }, ...big }).resize(OUT_W, OUT_H, { kernel: "lanczos3" });
  const encoded = file.endsWith(".png") ? resized.png({ compressionLevel: 9 }) : resized.jpeg({ quality: 92, chromaSubsampling: "4:4:4" });
  await encoded.toFile(path.join(outDir, file));
}

async function writeDerivedMaps({ raw, heightsM, width, height }) {
  const range = minMax(heightsM);
  const span = range.max - range.min;
  const relief = new Uint8Array(width * height);
  for (let i = 0; i < relief.length; i++) relief[i] = Math.round(((heightsM[i] - range.min) / span) * 255);
  await writeResized(relief, width, height, 1, "relief-4k.png");

  const { gradEast, gradNorth } = surfaceGradients(heightsM, width, height);
  const normal = new Uint8Array(width * height * 3);
  const slope = new Uint8Array(width * height);
  for (let i = 0; i < slope.length; i++) {
    const nx = -gradEast[i];
    const ny = -gradNorth[i];
    const len = Math.hypot(nx, ny, 1);
    normal[i * 3] = Math.round((nx / len * 0.5 + 0.5) * 255);
    normal[i * 3 + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
    normal[i * 3 + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
    const slopeDeg = Math.atan(Math.hypot(gradEast[i], gradNorth[i])) * (180 / Math.PI);
    slope[i] = Math.round(Math.min(slopeDeg / SLOPE_MAX_DEG, 1) * 255);
  }
  await writeResized(normal, width, height, 3, "normal-4k.jpg");
  await writeResized(slope, width, height, 1, "slope-4k.jpg");

  await writeHeightTiles(raw, width, height);
  return { range, width, height };
}

/** 16 位高度切成 10°×10° 的小块（R=高字节，G=低字节），第一人称只加载点击位置附近几块。 */
async function writeHeightTiles(raw, width, height) {
  const tilePx = width / (360 / TILE_DEG);
  const tileDir = path.join(outDir, "height-tiles");
  await mkdir(tileDir, { recursive: true });
  for (let row = 0; row < height / tilePx; row++) {
    for (let col = 0; col < width / tilePx; col++) {
      const packed = new Uint8Array(tilePx * tilePx * 3);
      for (let y = 0; y < tilePx; y++) {
        for (let x = 0; x < tilePx; x++) {
          const v = raw[(row * tilePx + y) * width + col * tilePx + x];
          const o = (y * tilePx + x) * 3;
          packed[o] = v >> 8;
          packed[o + 1] = v & 0xff;
        }
      }
      await sharp(packed, { raw: { width: tilePx, height: tilePx, channels: 3 } }).png({ compressionLevel: 9 }).toFile(path.join(tileDir, `${row}-${col}.png`));
    }
  }
}

await writeColorMaps();
const dem = await readHeightsM();
const { range, width, height } = await writeDerivedMaps(dem);
console.log(`height range ${range.min.toFixed(0)} m .. ${range.max.toFixed(0)} m (expect about -9100 .. +10800)`);

const meta = {
  projection: "simple cylindrical (equirectangular); column 0 = 180°W, centre = 0°, row 0 = 90°N",
  moonRadiusM: MOON_RADIUS_M,
  relief: { file: "relief-4k.png", minHeightM: range.min, maxHeightM: range.max, note: "8-bit, linear between min and max" },
  slope: { file: "slope-4k.jpg", maxSlopeDeg: SLOPE_MAX_DEG, note: "8-bit, 0..45 deg linear; computed at 1/16 deg (~1.9 km) spacing, so local slopes are understated" },
  normal: { file: "normal-4k.jpg", frame: "tangent (R=east, G=north, B=up), encoded n*0.5+0.5" },
  height16: { tiles: "height-tiles/{row}-{col}.png", tileDeg: TILE_DEG, tilePx: width / (360 / TILE_DEG), rowOrigin: "row 0 = 90N..80N, col 0 = 180W..170W", width, height, decode: "heightM = ((R << 8) | G) / 2 - 10000", pixelsPerDeg: 16 },
  color: { files: ["color-8k.jpg", "color-4k.jpg"] },
  sources: [
    "NASA Scientific Visualization Studio, CGI Moon Kit (https://svs.gsfc.nasa.gov/4720): lroc_color_poles_8k.tif, ldem_16_uint.tif",
    "Colour: LRO Wide Angle Camera mosaic, NASA/GSFC/Arizona State University. Heights: LRO LOLA, NASA/GSFC.",
  ],
};
await writeFile(path.join(outDir, "moon-meta.json"), JSON.stringify(meta, null, 2) + "\n");
console.log("done");
