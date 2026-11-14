"use client";
// Select Landing Site：打开后光标变成"选点"图标，点击地图放下一个标记（先是草稿，白色），
// 右侧浮动面板显示这个点的经纬度和各项数值；可以起名、保存、删除，保存两个以上可以去对比。
import type { PointAnalysis } from "../analysis/point-analysis";
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import { formatLatLon, type LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { MAX_SITES } from "../sites/use-saved-sites";
import { Caveat, PanelButton, PanelShell } from "./panel-shell";

export interface DraftSite extends LatLon {
  name: string;
}

interface SitesPanelProps {
  draft: DraftSite | null;
  draftAnalysis: PointAnalysis | "error" | null;
  onDraftName: (name: string) => void;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
  sites: SavedSite[];
  analyses: SiteAnalyses;
  selectedId: string | null;
  onSelect: (site: SavedSite) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onStandHere: (point: LatLon) => void;
  onCompare: () => void;
  onClose: () => void;
}

export function SitesPanel(props: SitesPanelProps) {
  const { draft, sites, selectedId } = props;
  const selected = draft ? null : (sites.find((site) => site.id === selectedId) ?? null);
  const selectedAnalysis = selected ? props.analyses[selected.id] : undefined;
  const full = sites.length >= MAX_SITES;

  return (
    <PanelShell title="Select Landing Site" onClose={props.onClose} side="right">
      {!draft && !selected && <p className="text-sm text-white/75">Click anywhere on the Moon to place a marker. Its latitude, longitude and site details appear here.</p>}

      {draft && (
        <SiteCard
          tag="New marker · not saved"
          name={draft.name}
          onName={props.onDraftName}
          point={draft}
          analysis={props.draftAnalysis ?? undefined}
          actions={
            <>
              <PanelButton primary onClick={props.onSaveDraft} disabled={full || draft.name.trim() === ""}>Save site</PanelButton>
              <PanelButton onClick={props.onDiscardDraft}>Delete marker</PanelButton>
              <PanelButton onClick={() => props.onStandHere(draft)}>Stand here</PanelButton>
            </>
          }
        />
      )}
      {draft && full && <p className="mt-2 text-xs text-amber-200">The list is full ({MAX_SITES}). Delete a saved site before saving this one.</p>}

      {selected && (
        <SiteCard
          tag="Saved site"
          name={selected.name}
          onName={(name) => props.onRename(selected.id, name)}
          point={selected}
          analysis={selectedAnalysis}
          actions={
            <>
              <PanelButton onClick={() => props.onRemove(selected.id)}>Delete site</PanelButton>
              <PanelButton onClick={() => props.onStandHere(selected)}>Stand here</PanelButton>
            </>
          }
        />
      )}

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">Saved sites</h3>
        <span className="font-mono text-[11px] text-white/45">{sites.length}/{MAX_SITES}</span>
      </div>
      {sites.length === 0 ? (
        <p className="mt-1 text-xs text-white/45">None yet. Place a marker, name it, then choose Save site.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {sites.map((site) => (
            <li key={site.id} className={`flex items-center gap-1 rounded-lg ${site.id === selected?.id ? "bg-lime-300/15" : "bg-white/[0.04]"}`}>
              <button type="button" onClick={() => props.onSelect(site)} className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left hover:bg-white/10">
                <span className="block truncate text-sm">{site.name}</span>
                <span className="block font-mono text-[11px] text-white/50">{formatLatLon(site)}</span>
              </button>
              <button type="button" onClick={() => props.onRemove(site.id)} aria-label={`Delete ${site.name}`} className="mr-1 rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-red-200">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 7h14M10 7V5h4v2m-6 0 1 12h6l1-12" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <PanelButton primary={!draft} onClick={props.onCompare} disabled={sites.length < 2}>
          {sites.length < 2 ? "Compare (save 2 or more)" : `Compare ${sites.length} sites`}
        </PanelButton>
      </div>
      <Caveat>Saved sites stay in this browser only. Elevation and slope are NASA LOLA data; sunlit time, temperature, ice potential and score are model estimates.</Caveat>
    </PanelShell>
  );
}

interface SiteCardProps {
  tag: string;
  name: string;
  onName: (name: string) => void;
  point: LatLon;
  analysis: PointAnalysis | "error" | undefined;
  actions: React.ReactNode;
}

function SiteCard({ tag, name, onName, point, analysis, actions }: SiteCardProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-lime-300/85">{tag}</p>
      <label className="mt-2 block text-[11px] text-white/50">
        Name
        <input
          value={name}
          maxLength={40}
          onChange={(e) => onName(e.target.value)}
          className="mt-0.5 block w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm font-medium text-white focus:border-lime-300/60 focus:outline-none"
        />
      </label>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        <Row label="Latitude" value={`${Math.abs(point.latDeg).toFixed(4)}° ${point.latDeg >= 0 ? "N" : "S"}`} />
        <Row label="Longitude" value={`${Math.abs(point.lonDeg).toFixed(4)}° ${point.lonDeg >= 0 ? "E" : "W"}`} />
        {analysis === "error" && <Row label="Details" value="unavailable (data could not be loaded)" />}
        {analysis === undefined && <Row label="Details" value="loading…" />}
        {analysis && analysis !== "error" && (
          <>
            <Row label="Elevation" value={`${analysis.heightM >= 0 ? "+" : ""}${analysis.heightM.toFixed(0)} m`} />
            <Row label="Slope" value={`${analysis.slopeDeg.toFixed(1)}°`} />
            <Row label="Sunlit time" value={`${(analysis.illuminationFraction * 100).toFixed(0)}%`} />
            <Row label="Temperature now" value={`${analysis.temperatureNowK.toFixed(0)} K (${(analysis.temperatureNowK - 273.15).toFixed(0)}°C)`} />
            <Row label="Ice potential" value={analysis.iceIndex.toFixed(2)} />
            <Row label="Earth in view" value={`${(analysis.earthVisibleFraction * 100).toFixed(0)}%`} />
            <Row label="Suitability" value={analysis.suitability.toFixed(2)} />
          </>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-white/50">{label}</dt>
      <dd className="font-mono text-white/90">{value}</dd>
    </>
  );
}
