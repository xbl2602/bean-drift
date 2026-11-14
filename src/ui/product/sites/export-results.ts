// 导出候选点分析：CSV（给表格软件）和 JSON（给程序）。文件在浏览器里生成并下载，不经过服务器。
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import type { SuitabilityWeights } from "../map-layers";
import { greatCircleDistanceKm, type LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { METRIC_ROWS, SOURCE_NOTES } from "./metric-rows";

export interface ExportInput {
  sites: SavedSite[];
  analyses: SiteAnalyses;
  timeMs: number;
  weights: SuitabilityWeights;
  measurePoints: LatLon[];
}

const DATA_SOURCES = [
  "Heights and slopes: NASA LRO LOLA via NASA SVS CGI Moon Kit (https://svs.gsfc.nasa.gov/4720)",
  "Sun and Earth angles: Lunar Quest ephemeris (truncated Meeus + IAU lunar orientation), checked against JPL Horizons",
  "Place names: IAU Gazetteer of Planetary Nomenclature, USGS",
];

function analysedSites({ sites, analyses }: ExportInput) {
  return sites.map((site) => {
    const analysis = analyses[site.id];
    return { site, analysis: analysis && analysis !== "error" ? analysis : null };
  });
}

/** CSV 字段里有逗号、引号或换行时要加引号，引号本身写两遍。 */
const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function buildCsv(input: ExportInput): string {
  const header = ["name", "lat_deg", "lon_deg_east", "time_utc", ...METRIC_ROWS.map((row) => `${row.key} [${row.unit}] (${row.source})`)];
  const lines = [header.map(csvCell).join(",")];
  for (const { site, analysis } of analysedSites(input)) {
    const metrics = METRIC_ROWS.map((row) => (analysis ? row.value(analysis).toFixed(Math.max(row.digits, 2)) : ""));
    lines.push([site.name, site.latDeg.toFixed(5), site.lonDeg.toFixed(5), new Date(input.timeMs).toISOString(), ...metrics].map(csvCell).join(","));
  }
  lines.push("", ...Object.values(SOURCE_NOTES).map((note) => csvCell(`# ${note}`)), ...DATA_SOURCES.map((source) => csvCell(`# ${source}`)));
  return lines.join("\r\n") + "\r\n";
}

export function buildJson(input: ExportInput): string {
  const { measurePoints } = input;
  const legsKm = measurePoints.slice(1).map((point, i) => greatCircleDistanceKm(measurePoints[i], point));
  return JSON.stringify(
    {
      generatedBy: "Lunar Quest",
      generatedAtUtc: new Date().toISOString(),
      analysisTimeUtc: new Date(input.timeMs).toISOString(),
      conventions: { longitude: "degrees, east positive, -180..180", elevation: "metres relative to the 1737.4 km reference sphere", distance: "great-circle on the 1737.4 km sphere" },
      suitabilityWeights: input.weights,
      sites: analysedSites(input).map(({ site, analysis }) => ({
        name: site.name,
        latDeg: site.latDeg,
        lonDeg: site.lonDeg,
        metrics: analysis ? Object.fromEntries(METRIC_ROWS.map((row) => [row.key, { value: Number(row.value(analysis).toFixed(4)), unit: row.unit, source: row.source }])) : null,
        suitabilityScores: analysis?.scores ?? null,
      })),
      measurement: measurePoints.length >= 2 ? { points: measurePoints, legsKm, totalKm: legsKm.reduce((sum, km) => sum + km, 0) } : null,
      notes: SOURCE_NOTES,
      dataSources: DATA_SOURCES,
    },
    null,
    2,
  );
}

export function downloadTextFile(filename: string, mimeType: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const exportFileStem = (timeMs: number) => `lunar-quest-sites-${new Date(timeMs).toISOString().slice(0, 10)}`;
