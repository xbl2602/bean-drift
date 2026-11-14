// 把 IAU/USGS 月面地名表（shapefile 的 .dbf 属性表）转成网页搜索用的精简 JSON。离线运行一次，不被网页 import。
//
// 输入：https://planetarynames.wr.usgs.gov/GIS_Downloads 的 MOON_nomenclature_center_pts.zip 解压后的 .dbf
// 输出：public/product/moon/lunar-names.json  ->  { source, fields, names: [[name, type, latDeg, lonDeg(东经为正,-180..180), diameterKm], ...] }
//
// 用法：node build-lunar-names.mjs <MOON_nomenclature_center_pts.dbf> <输出目录>            正式生成
//       node build-lunar-names.mjs <MOON_nomenclature_center_pts.dbf> --inspect            只打印字段名和前两行
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [dbfPath, outDirOrFlag] = process.argv.slice(2);
if (!dbfPath || !outDirOrFlag) {
  console.error("usage: node build-lunar-names.mjs <file.dbf> <outDir | --inspect>");
  process.exit(1);
}

/** dBASE III 表：32 字节文件头 + 每字段 32 字节描述 + 定长记录。 */
function readDbf(buffer) {
  const recordCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields = [];
  for (let offset = 32; buffer[offset] !== 0x0d; offset += 32) {
    fields.push({ name: buffer.toString("ascii", offset, offset + 11).replace(/\0.*$/, ""), length: buffer[offset + 16] });
  }
  const decoder = new TextDecoder("utf-8");
  const rows = [];
  for (let r = 0; r < recordCount; r++) {
    let pos = headerLength + r * recordLength;
    if (buffer[pos] === 0x2a) continue; // 已删除的记录
    pos += 1;
    const row = {};
    for (const field of fields) {
      row[field.name] = decoder.decode(buffer.subarray(pos, pos + field.length)).trim();
      pos += field.length;
    }
    rows.push(row);
  }
  return { fields, rows };
}

const { fields, rows } = readDbf(await readFile(dbfPath));

if (outDirOrFlag === "--inspect") {
  console.log(fields.map((f) => `${f.name}(${f.length})`).join(" "));
  console.log(rows.slice(0, 2));
  console.log("rows:", rows.length);
  process.exit(0);
}

const normalizeLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
const names = [];
for (const row of rows) {
  if (!/adopted|approved/i.test(row.approval)) continue; // 只要 IAU 已采纳的名称（表里写作 "Adopted by IAU"）
  const lat = Number(row.center_lat);
  const lon = Number(row.center_lon);
  if (!row.clean_name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  // type 形如 "Sinus, sinūs"（单数, 复数），只留单数
  names.push([row.clean_name, row.type.split(",")[0], Number(lat.toFixed(4)), Number(normalizeLon(lon).toFixed(4)), Number(Number(row.diameter || 0).toFixed(1))]);
}
// 大的地物排前面：同名前缀时先出现大环形山、月海
names.sort((a, b) => b[4] - a[4]);

const out = {
  source: "IAU Gazetteer of Planetary Nomenclature, USGS Astrogeology Science Center (https://planetarynames.wr.usgs.gov), Moon centre points",
  fields: ["name", "featureType", "latDeg", "lonDegEastPositive", "diameterKm"],
  names,
};
await writeFile(path.join(outDirOrFlag, "lunar-names.json"), JSON.stringify(out));
console.log(`wrote ${names.length} names`);
