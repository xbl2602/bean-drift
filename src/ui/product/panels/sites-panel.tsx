"use client";
// Pick a location, inspect its data, then optionally send it to the comparison window.
// Location details stay here; comparison candidates are managed in the bottom comparison window.
import type { PointAnalysis } from "../analysis/point-analysis";
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import type { LatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { MAX_SITES } from "../sites/use-saved-sites";
import { SiteDataCard as SiteCard } from "./site-data-card";
import { PanelButton, PanelShell } from "./panel-shell";
import { SitePhoto } from "./site-photo";

export interface DraftSite extends LatLon {
  name: string;
}

interface SitesPanelProps {
  draft: DraftSite | null;
  draftAnalysis: PointAnalysis | "error" | null;
  onDraftName: (name: string) => void;
  onSaveDraft: () => void;
  sites: SavedSite[];
  analyses: SiteAnalyses;
  selectedId: string | null;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onStandHere: (point: LatLon) => void;
  /** 打开 Evaluate → Compare Landing Sites。 */
  onCompare: () => void;
  /** 地图当前时刻：照片里的太阳和阴影按它画。 */
  timeMs: number;
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
          tag="Selected location"
          name={draft.name}
          onName={props.onDraftName}
          point={draft}
          analysis={props.draftAnalysis ?? undefined}
          photo={<SitePhoto point={draft} name={draft.name} timeMs={props.timeMs} onStandHere={() => props.onStandHere(draft)} />}
          actions={
            <>

              <div className="col-span-2"><PanelButton onClick={() => props.onStandHere(draft)}>Stand here</PanelButton></div>
            </>
          }
        />
      )}
      {draft && full && <p className="mt-2 text-xs text-amber-200">The list is full ({MAX_SITES}). Remove one in Compare Landing Sites first.</p>}

      {selected && (
        <SiteCard
          tag="Comparison candidate"
          name={selected.name}
          onName={(name) => props.onRename(selected.id, name)}
          point={selected}
          analysis={selectedAnalysis}
          photo={<SitePhoto point={selected} name={selected.name} timeMs={props.timeMs} onStandHere={() => props.onStandHere(selected)} />}
          actions={
            <>

              <div className="col-span-2"><PanelButton onClick={() => props.onStandHere(selected)}>Stand here</PanelButton></div>
            </>
          }
        />
      )}

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[11px] leading-snug text-slate-400">Want to compare this location?</p>
        <button type="button" onClick={props.onCompare} disabled={(!draft && sites.length === 0) || Boolean(draft && (full || !draft.name.trim()))} className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-left text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:border-lime-300/40 hover:bg-lime-300/10">
          <span>{draft ? "Add to comparison" : sites.length ? "Compare landing sites" : "Pick a location first"}<span className="ml-2 font-mono text-[11px] font-normal text-slate-400">{sites.length} selected</span></span>
          <span aria-hidden="true" className="text-lime-300">→</span>
        </button>
      </div>
    </PanelShell>
  );
}
