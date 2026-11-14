// Rebuild the globe sky assets from the NASA originals listed in docs/CREDITS.md.
// Usage: node src/ui/product/data-build/build-sky-textures.mjs <earth-8192.jpg> <sun-4096.jpg>
// Requires sharp (same offline image tool as build-moon-textures.mjs).
import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const [earthSource, sunSource] = process.argv.slice(2);
if (!earthSource || !sunSource) throw new Error("Provide the NASA 8192x4096 Earth JPEG and 4096x4096 SDO JPEG.");
const earth = await sharp(earthSource).metadata();
const sun = await sharp(sunSource).metadata();
if (earth.width !== 8192 || earth.height !== 4096 || sun.width !== 4096 || sun.height !== 4096) {
  throw new Error("Unexpected image dimensions; use the credited originals without upscaling.");
}
const output = fileURLToPath(new URL("../../../../public/product/sky/", import.meta.url));
await mkdir(output, { recursive: true });
await sharp(earthSource).jpeg({ quality: 92 }).toFile(path.join(output, "earth-8k.jpg"));
await sharp(earthSource).resize(4096, 2048).jpeg({ quality: 92 }).toFile(path.join(output, "earth-4k.jpg"));
await copyFile(sunSource, path.join(output, "sun-sdo-4k.jpg"));
console.log("Built 8K/4K Earth and 4K Sun assets at", output);
