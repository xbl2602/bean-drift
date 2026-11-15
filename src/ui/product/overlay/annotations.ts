// 画在地图上的标注：候选着陆点、测距折线、搜索结果的定位圈。2D 和 3D 共用同一份数据和同一套 SVG 画法，
// 各自只提供"经纬度 -> 屏幕坐标"的投影函数。
import { greatCircleDistanceKm, greatCirclePath, type LatLon } from "../moon-frames";

export interface SavedSite extends LatLon {
  id: string;
  name: string;
  createdAt: string;
}

/** 地图上画的点；markerColor 不给就用默认的黄绿色（比如 Landing Sites 里载人、无人用不同颜色）。 */
export type AnnotatedSite = SavedSite & { markerColor?: string };

export interface MapAnnotations {
  sites: AnnotatedSite[];
  measurePoints: LatLon[];
  searchPin: (LatLon & { label: string; detail?: string }) | null;
  /** 刚点下去、还没保存的候选点（白色标记）。 */
  draftSite?: (LatLon & { label: string }) | null;
  /** 面板里正在看的那个已保存候选点，标记画大一点。 */
  selectedSiteId?: string | null;
}

export const EMPTY_ANNOTATIONS: MapAnnotations = { sites: [], measurePoints: [], searchPin: null };

/** 返回屏幕坐标（CSS 像素）；看不见（比如在球的背面）返回 null。 */
export type Projector = (point: LatLon) => { x: number; y: number } | null;

const escapeXml = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
const LABEL_STYLE = 'font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" font-weight="600" paint-order="stroke" stroke="#000" stroke-width="3" stroke-linejoin="round"';

/** 沿大圆取点连线；遇到看不见的点或屏幕上跳得很远（2D 图左右循环处）就断开。 */
function pathBetween(a: LatLon, b: LatLon, project: Projector, maxJumpPx: number): string {
  let d = "";
  let previous: { x: number; y: number } | null = null;
  for (const point of greatCirclePath(a, b, 48)) {
    const s = project(point);
    if (!s) {
      previous = null;
      continue;
    }
    const jump = previous ? Math.hypot(s.x - previous.x, s.y - previous.y) : Infinity;
    d += `${previous && jump < maxJumpPx ? "L" : "M"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
    previous = s;
  }
  return d;
}

export function renderAnnotationsSvg(annotations: MapAnnotations, project: Projector, screenWidthPx: number): string {
  const parts: string[] = [];
  const { measurePoints, sites, searchPin } = annotations;

  let totalKm = 0;
  measurePoints.forEach((point, i) => {
    if (i > 0) {
      totalKm += greatCircleDistanceKm(measurePoints[i - 1], point);
      const d = pathBetween(measurePoints[i - 1], point, project, screenWidthPx / 3);
      if (d) parts.push(`<path d="${d}" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="4"/><path d="${d}" fill="none" stroke="#fde047" stroke-width="2" stroke-dasharray="6 4"/>`);
    }
    const s = project(point);
    if (!s) return;
    parts.push(`<circle cx="${s.x}" cy="${s.y}" r="5" fill="#fde047" stroke="#000" stroke-width="1.5"/>`);
    if (i > 0) parts.push(`<text x="${s.x + 9}" y="${s.y - 8}" fill="#fde047" ${LABEL_STYLE}>${totalKm.toFixed(totalKm < 100 ? 1 : 0)} km</text>`);
  });

  for (const site of sites) {
    const s = project(site);
    if (!s) continue;
    const selected = site.id === annotations.selectedSiteId;
    parts.push(
      (selected ? `<circle cx="${s.x}" cy="${s.y - 16}" r="15" fill="none" stroke="#fff" stroke-width="2"/>` : "") +
        `<path d="M${s.x} ${s.y}l-7 -11a8.5 8.5 0 1 1 14 0z" fill="${site.markerColor ?? "#bef264"}" stroke="#0d1400" stroke-width="1.5"/><circle cx="${s.x}" cy="${s.y - 16}" r="3" fill="#0d1400"/>` +
        `<text x="${s.x + (selected ? 20 : 12)}" y="${s.y - 13}" fill="#f7fee7" ${LABEL_STYLE}>${escapeXml(site.name)}</text>`,
    );
  }

  const draft = annotations.draftSite;
  const draftAt = draft ? project(draft) : null;
  if (draft && draftAt) {
    const s = draftAt;
    parts.push(
      `<circle cx="${s.x}" cy="${s.y - 16}" r="15" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>` +
        `<path d="M${s.x} ${s.y}l-7 -11a8.5 8.5 0 1 1 14 0z" fill="#fff" stroke="#0d1400" stroke-width="1.5"/><circle cx="${s.x}" cy="${s.y - 16}" r="3" fill="#0d1400"/>` +
        `<text x="${s.x + 20}" y="${s.y - 13}" fill="#fff" ${LABEL_STYLE}>${escapeXml(draft.label)}</text>`,
    );
  }

  if (searchPin) {
    const s = project(searchPin);
    if (s) {
      parts.push(
        `<circle cx="${s.x}" cy="${s.y}" r="14" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="4"/><circle cx="${s.x}" cy="${s.y}" r="14" fill="none" stroke="#f0abfc" stroke-width="2"/><circle cx="${s.x}" cy="${s.y}" r="2.5" fill="#f0abfc"/>` +
          `<text x="${s.x + 20}" y="${s.y + 4}" fill="#fae8ff" ${LABEL_STYLE}>${escapeXml(searchPin.label)}</text>` +
          (searchPin.detail ? `<text x="${s.x + 20}" y="${s.y + 19}" fill="#fae8ff" fill-opacity="0.85" font-family="ui-monospace,monospace" font-size="11" paint-order="stroke" stroke="#000" stroke-width="3" stroke-linejoin="round">${escapeXml(searchPin.detail)}</text>` : ""),
      );
    }
  }
  return parts.join("");
}

/** 盖在画布上的一层 SVG，不接收鼠标事件。内容没变就不碰 DOM。 */
export class AnnotationLayer {
  private readonly svg: SVGSVGElement;
  private lastMarkup = "";

  constructor(container: HTMLElement) {
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "pointer-events-none absolute inset-0 h-full w-full");
    container.appendChild(this.svg);
  }

  draw(annotations: MapAnnotations, project: Projector, screenWidthPx: number) {
    const markup = renderAnnotationsSvg(annotations, project, screenWidthPx);
    if (markup === this.lastMarkup) return;
    this.lastMarkup = markup;
    this.svg.innerHTML = markup;
  }

  dispose() {
    this.svg.remove();
  }
}
