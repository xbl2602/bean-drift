// Build genuine 16K Moon colour imagery without changing terrain or lighting.
// NASA SVS CGI Moon Kit: https://svs.gsfc.nasa.gov/4720
// Usage: node src/ui/product/data-build/build-moon-color-16k.mjs <lroc_color_poles_16k.tif>
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const source = process.argv[2];
if (!source) throw new Error("Provide NASA's original lroc_color_poles_16k.tif.");
const meta = await sharp(source).metadata();
if (meta.width !== 16384 || meta.height !== 8192) throw new Error("Expected genuine 16384 x 8192 imagery; upscaling is not used.");
const directory = new URL("../../../../public/product/moon/", import.meta.url);
await mkdir(fileURLToPath(directory), { recursive: true });
await sharp(source).jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toFile(fileURLToPath(new URL("color-16k.jpg", directory)));
console.log("Built 16K Moon texture.");
