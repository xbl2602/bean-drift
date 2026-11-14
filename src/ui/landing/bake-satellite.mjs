// One-off baking script for the relay satellite (run it by hand; the page does not use it):
//
//   node src/ui/landing/bake-satellite.mjs
//
// It writes into public/landing/satellite/:
//   - foil-color.png / foil-normal.png   crinkled gold insulation foil (tileable)
//   - panel-color.png / panel-normal.png solar-cell grid with busbars and a frame
//   - dish-color.png / dish-normal.png   painted dish with ribs
//   - ao.json                            ambient occlusion baked per vertex for every model part
//
// No outside tools are needed: the PNGs are written with Node's zlib, and the occlusion is found by
// casting rays against the model itself (three.js runs fine in Node for geometry work).
// The numbers are deterministic, so running it again gives the same files.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { buildSatelliteParts, GROUP_ORIGIN } from "./satellite-model.ts";

const OUT = path.join(process.cwd(), "public", "landing", "satellite");
mkdirSync(OUT, { recursive: true });

// ---------- tiny PNG writer ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function writePng(file, size, rgb) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}

// ---------- tileable noise ----------
const hash = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function valueNoise(u, v, cells, seed) {
  const x = u * cells;
  const y = v * cells;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (i, j) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const SIZE = 512;

/** Turns a height field into a tangent-space normal map (wrapping at the edges, so it tiles). */
function normalMap(height, strength) {
  const out = Buffer.alloc(SIZE * SIZE * 3);
  const at = (x, y) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 3;
      out[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((dy / len * 0.5 + 0.5) * 255); // flipped: image rows run top to bottom
      out[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

// ---------- foil: crumpled gold insulation ----------
{
  const height = new Float32Array(SIZE * SIZE);
  const color = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      // Creases: ridged noise at several scales.
      let h = 0;
      let amp = 1;
      for (const [cells, seed] of [[6, 1], [14, 2], [31, 3], [64, 4]]) {
        h += (1 - Math.abs(valueNoise(u, v, cells, seed) * 2 - 1)) * amp;
        amp *= 0.55;
      }
      h /= 1.9;
      height[y * SIZE + x] = h;
      const patch = clamp01((valueNoise(u, v, 4, 9) - 0.58) * 6); // a few silver-coloured patches
      const shade = 0.72 + 0.5 * h;
      const gold = [226, 168, 72];
      const silver = [205, 207, 212];
      const i = (y * SIZE + x) * 3;
      for (let c = 0; c < 3; c++) color[i + c] = Math.round(Math.min(255, (gold[c] * (1 - patch) + silver[c] * patch) * shade));
    }
  }
  writePng(path.join(OUT, "foil-color.png"), SIZE, color);
  writePng(path.join(OUT, "foil-normal.png"), SIZE, normalMap(height, 5.5));
}

// ---------- solar panel: 8 x 8 cells, busbars, frame ----------
{
  const height = new Float32Array(SIZE * SIZE);
  const color = Buffer.alloc(SIZE * SIZE * 3);
  const cells = 8;
  const cell = SIZE / cells;
  const frame = 9;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 3;
      const inFrame = x < frame || y < frame || x >= SIZE - frame || y >= SIZE - frame;
      const cx = x % cell;
      const cy = y % cell;
      const gap = 3;
      const inGap = cx < gap || cy < gap;
      let rgb;
      let h;
      if (inFrame) {
        rgb = [168, 172, 180];
        h = 1.0;
      } else if (inGap) {
        rgb = [58, 62, 74];
        h = 0.0;
      } else {
        const cellId = Math.floor(x / cell) + Math.floor(y / cell) * cells;
        const vary = 0.85 + 0.3 * hash(cellId, 7, 3); // each cell is a slightly different blue
        const sheen = 0.65 + 0.35 * (1 - (cy / cell));
        const base = [22, 36, 96];
        rgb = base.map((c) => Math.min(255, c * vary * (0.8 + 0.4 * sheen)));
        // Two thin busbars down every cell.
        const bus = Math.abs(cx - cell / 3) < 1.2 || Math.abs(cx - (2 * cell) / 3) < 1.2;
        if (bus) rgb = [176, 180, 188];
        // A faint grid of finger lines.
        else if (cy % 7 === 0) rgb = rgb.map((c) => c * 1.25);
        h = bus ? 0.65 : 0.5;
      }
      height[y * SIZE + x] = h;
      for (let c = 0; c < 3; c++) color[i + c] = Math.round(rgb[c]);
    }
  }
  // Soften the height field a little so the grooves have bevelled edges.
  const soft = new Float32Array(height.length);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += height[((y + dy + SIZE) % SIZE) * SIZE + ((x + dx + SIZE) % SIZE)];
      soft[y * SIZE + x] = sum / 9;
    }
  }
  writePng(path.join(OUT, "panel-color.png"), SIZE, color);
  writePng(path.join(OUT, "panel-normal.png"), SIZE, normalMap(soft, 3.2));
}

// ---------- dish: white paint with radial ribs and rings ----------
{
  const height = new Float32Array(SIZE * SIZE);
  const color = Buffer.alloc(SIZE * SIZE * 3);
  const ribs = 24;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE; // around the dish
      const v = y / SIZE; // from the centre outwards
      const rib = Math.abs(((u * ribs) % 1) - 0.5) * 2; // 1 on the rib, 0 between
      const onRib = rib > 0.93;
      const ring = [0.22, 0.45, 0.7, 0.93].some((r) => Math.abs(v - r) < 0.006);
      const speckle = valueNoise(u, v, 48, 5) * 0.06;
      const base = 232 - speckle * 120;
      const dark = onRib || ring ? 0.72 : 1;
      const i = (y * SIZE + x) * 3;
      color[i] = Math.round(base * dark);
      color[i + 1] = Math.round((base + 2) * dark);
      color[i + 2] = Math.round((base + 6) * dark);
      height[y * SIZE + x] = (onRib || ring ? 1 : 0) + speckle;
    }
  }
  writePng(path.join(OUT, "dish-color.png"), SIZE, color);
  writePng(path.join(OUT, "dish-normal.png"), SIZE, normalMap(height, 2.4));
}

// ---------- ambient occlusion, baked per vertex ----------
{
  const parts = buildSatelliteParts({ THREE, RoundedBoxGeometry });
  const meshes = parts.map((part) => {
    const mesh = new THREE.Mesh(part.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const origin = GROUP_ORIGIN[part.group];
    mesh.position.set(part.position[0] + origin[0], part.position[1] + origin[1], part.position[2] + origin[2]);
    mesh.rotation.set(...part.rotation);
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  const raycaster = new THREE.Raycaster();
  raycaster.far = 0.75;
  const RAYS = 24;
  const normalMatrix = new THREE.Matrix3();
  const ao = {};
  let vertexTotal = 0;
  meshes.forEach((mesh, index) => {
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const values = new Uint8Array(positions.count);
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const bitangent = new THREE.Vector3();
    const direction = new THREE.Vector3();
    for (let v = 0; v < positions.count; v++) {
      point.fromBufferAttribute(positions, v).applyMatrix4(mesh.matrixWorld);
      normal.fromBufferAttribute(normals, v).applyMatrix3(normalMatrix).normalize();
      tangent.set(Math.abs(normal.x) < 0.9 ? 1 : 0, Math.abs(normal.x) < 0.9 ? 0 : 1, 0).cross(normal).normalize();
      bitangent.crossVectors(normal, tangent);
      let occlusion = 0;
      for (let r = 0; r < RAYS; r++) {
        // Cosine-weighted directions over the hemisphere (a fixed, well-spread pattern per ray).
        const a = (r + 0.5) / RAYS;
        const radius = Math.sqrt(a);
        const phi = r * 2.399963;
        direction.copy(tangent).multiplyScalar(Math.cos(phi) * radius).addScaledVector(bitangent, Math.sin(phi) * radius).addScaledVector(normal, Math.sqrt(1 - a));
        raycaster.set(point.clone().addScaledVector(normal, 0.004), direction);
        const hit = raycaster.intersectObjects(meshes.filter((_, j) => j !== index || true), false)[0];
        if (hit && hit.distance > 0.002) occlusion += 1 - hit.distance / raycaster.far;
      }
      values[v] = Math.round(clamp01(1 - (occlusion / RAYS) * 1.1) * 255);
    }
    ao[parts[index].name] = Buffer.from(values).toString("base64");
    vertexTotal += positions.count;
  });
  writeFileSync(path.join(OUT, "ao.json"), JSON.stringify(ao));
  console.log(`baked ambient occlusion for ${parts.length} parts, ${vertexTotal} vertices`);
}
console.log("done");
