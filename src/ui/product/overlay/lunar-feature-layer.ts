import { loadLunarNames } from "../search/lunar-names";
import type { MapAnnotations, Projector } from "./annotations";
import { layoutLunarLabels, prepareLunarLabels, type LabelRect, type LabelViewport, type LunarLabelFeature } from "./lunar-label-layout";

const escapeXml = (text: string) => text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]!);

/** A quiet cartographic overlay, below user pins; loaded once through the existing name cache. */
export class LunarFeatureLayer {
  private readonly svg: SVGSVGElement;
  private readonly measureContext = document.createElement("canvas").getContext("2d");
  private readonly widths = new Map<string, number>();
  private features: LunarLabelFeature[] = [];
  private disposed = false;
  private failed = false;
  private lastMarkup = "";

  constructor(container: HTMLElement, invalidate: () => void) {
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "pointer-events-none absolute inset-0 h-full w-full");
    this.svg.setAttribute("role", "group");
    this.svg.setAttribute("aria-label", "Lunar place names");
    container.appendChild(this.svg);
    loadLunarNames().then(names => {
      if (this.disposed) return;
      this.features = prepareLunarLabels(names);
      invalidate();
    }).catch(() => {
      if (this.disposed) return;
      this.failed = true;
      invalidate();
    });
  }

  private measure = (text: string, fontSize: number): number => {
    const key = `${fontSize}:${text}`;
    let width = this.widths.get(key);
    if (width !== undefined) return width;
    if (this.measureContext) this.measureContext.font = `500 ${fontSize}px system-ui,sans-serif`;
    width = this.measureContext?.measureText(text).width ?? text.length * fontSize * 0.56;
    this.widths.set(key, width);
    return width;
  };

  draw(annotations: MapAnnotations, project: Projector, view: LabelViewport) {
    const blocked: LabelRect[] = [];
    const reserve = (point: Parameters<Projector>[0], name: string, detail = false) => {
      const p = project(point);
      if (p) blocked.push({ left: p.x - 23, top: p.y - 38, right: p.x + 40 + this.measure(name, 12), bottom: p.y + (detail ? 29 : 12) });
    };
    annotations.sites.forEach(site => reserve(site, site.name));
    if (annotations.draftSite) reserve(annotations.draftSite, annotations.draftSite.label);
    if (annotations.searchPin) reserve(annotations.searchPin, annotations.searchPin.label, true);
    annotations.measurePoints.forEach(point => reserve(point, "99999 km"));
    const labels = layoutLunarLabels(this.features, project, view, blocked, this.measure);
    const markup = this.failed
      ? `<text x="100" y="${Math.max(110, view.heightPx - 106)}" fill="#cbd5e1" font-size="10" paint-order="stroke" stroke="#050a10" stroke-width="3">Place names unavailable · reload to retry</text>`
      : labels.map(label => `<g data-lunar-name="${escapeXml(label.feature.name)}" data-name-tier="${label.feature.tier}" opacity="${label.opacity.toFixed(2)}"><circle cx="${label.x.toFixed(1)}" cy="${label.y.toFixed(1)}" r="1.5" fill="#dce6eb" stroke="#050a10" stroke-width="1"/><text x="${label.x.toFixed(1)}" y="${(label.y - 7).toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${label.fontSize}" font-weight="500" fill="#e0e7eb" paint-order="stroke" stroke="#050a10" stroke-opacity="0.8" stroke-width="2.5" stroke-linejoin="round">${escapeXml(label.feature.name)}</text></g>`).join("");
    if (markup === this.lastMarkup) return;
    this.lastMarkup = markup;
    this.svg.innerHTML = markup;
  }

  dispose() { this.disposed = true; this.svg.remove(); }
}
