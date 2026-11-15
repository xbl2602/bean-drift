"use client";
import type { LatLon } from "../moon-frames";
import { formatLatLon } from "../moon-frames";
import { ToolIcon } from "../menu/tool-menu";
import type { SavedSite } from "../overlay/annotations";
import { MAX_SITES } from "../sites/use-saved-sites";
import { PanelButton, PanelShell } from "./panel-shell";
import { CoordinateBox } from "./site-metric-bars";

export interface DraftSite extends LatLon { name: string }

interface SitesPanelProps {
  draft: DraftSite | null;
  onDraftName: (name: string) => void;
  onSaveDraft: () => void;
  sites: SavedSite[];
  selectedId: string | null;
  onSelectSite: (site: SavedSite) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onCompare: () => void;
  onClose: () => void;
}

/** The comparison picker owns candidate actions; it never opens results implicitly. */
export function SitesPanel(props: SitesPanelProps) {
  const { draft, sites } = props;
  const selected = draft ? null : sites.find(site => site.id === props.selectedId);
  const point = draft ?? selected;
  const full = sites.length >= MAX_SITES;
  return <PanelShell title="Choose comparison sites" onClose={props.onClose} side="right">
    <p className="text-sm leading-relaxed text-white/75">Click the Moon to choose a location, then add it to your comparison.</p>
    {point ? <section aria-label="Selected comparison location" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lime-200">{draft ? "Selected location" : "Already added"}</p>
      <label className="mt-3 block text-xs text-slate-400">Site name
        <input value={point.name} maxLength={40} onChange={event => draft ? props.onDraftName(event.target.value) : selected && props.onRename(selected.id, event.target.value)} className="mt-1 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm font-medium text-white focus:border-lime-300 focus:outline-none" />
      </label>
      <CoordinateBox point={point} />
      <div className="mt-4 grid"><PanelButton primary onClick={props.onSaveDraft} disabled={!draft || full || !draft.name.trim()}>{draft ? "Add site" : "Added"}</PanelButton></div>
    </section> : <p className="mt-4 rounded-xl border border-dashed border-white/20 px-4 py-5 text-center text-sm text-slate-400">Choose your next site on the map.</p>}
    {draft && full && <p className="mt-2 text-xs text-amber-200">The list is full ({MAX_SITES}). Remove a site below to add another.</p>}

    <section aria-label="Selected comparison sites" className="mt-5">
      <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-200">Sites to compare</h3><span className="font-mono text-xs text-slate-400">{sites.length}/{MAX_SITES}</span></div>
      {sites.length === 0 ? <p className="mt-3 text-xs leading-relaxed text-slate-400">No sites added yet. Pick a location and choose Add site.</p> : <ul className="mt-3 space-y-2">
        {sites.map(site => <li key={site.id} className={`flex items-center gap-2 rounded-xl border p-2 ${site.id === props.selectedId ? "border-lime-200/30 bg-lime-200/5" : "border-white/10 bg-white/[0.025]"}`}>
          <button type="button" onClick={() => props.onSelectSite(site)} aria-label={`Show ${site.name} on map`} className="min-w-0 flex-1 rounded-lg px-1 text-left focus-visible:outline focus-visible:outline-lime-200"><span className="block truncate text-sm font-medium text-slate-100">{site.name}</span><span className="mt-1 block font-mono text-[10px] text-slate-400">{formatLatLon(site)}</span></button>
          <button type="button" aria-label={`Remove ${site.name}`} title={`Remove ${site.name}`} onClick={() => props.onRemove(site.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:border-red-200/30 hover:bg-red-200/10 hover:text-red-100 focus-visible:outline focus-visible:outline-lime-200"><ToolIcon path="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" className="h-4 w-4" /></button>
        </li>)}
      </ul>}
    </section>
    <div className="mt-5 border-t border-white/10 pt-4">
      {sites.length < 2 && <p className="mb-3 text-xs text-slate-400">Add at least two sites to compare.</p>}
      <button type="button" disabled={sites.length < 2} onClick={props.onCompare} className="w-full rounded-xl bg-lime-300 px-4 py-3 text-sm font-semibold text-[#11180a] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">Compare</button>
    </div>
  </PanelShell>;
}
