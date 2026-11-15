"use client";
// Select Landing Site：打开后光标变成"选点"图标，点击地图放下一个标记（先是草稿，白色），
// 右侧浮动面板显示这个点的经纬度和各项数值；可以起名、保存、删除，保存两个以上可以去对比。
import type { PointAnalysis } from "../analysis/point-analysis";
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import { formatLatLon, type LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { MAX_SITES } from "../sites/use-saved-sites";
import { SiteDataCard as SiteCard } from "./site-data-card";
import { PanelButton, PanelShell } from "./panel-shell";

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
        <div><h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">Saved sites</h3><p className="mt-1 text-[10px] text-slate-500">Stored in this browser</p></div>
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
        <button type="button" onClick={props.onCompare} disabled={sites.length < 2} className="w-full rounded-xl bg-lime-300 px-3 py-3 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400">
          {sites.length < 2 ? "Save 2 sites to compare" : `Compare ${sites.length} landing sites`}
        </button>
      </div>
    </PanelShell>
  );
}
