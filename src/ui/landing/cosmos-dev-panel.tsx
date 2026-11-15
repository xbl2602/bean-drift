"use client";

// Developer panel for the closing ASCII scene: a slider for every look-and-feel number, so the
// look can be tuned by eye. Hidden from visitors: it opens only with `?dev` on the address of a development build. Values are kept in
// this browser; "Copy changed values" gives the text to send back so they can become the defaults.
// Nothing here is shown to normal visitors.

import { useEffect, useRef, useState } from "react";
import type { AsciiCosmos } from "./ascii-cosmos";
import { changedParamsText, type CosmosParams, DEFAULT_PARAMS, PARAM_DEFS, type ParamDef, type ParamKey } from "./cosmos-params";

const GROUPS = Array.from(new Set(PARAM_DEFS.map((def) => def.group)));

function ParamControl({ def, value, onChange }: { def: ParamDef; value: number; onChange: (value: number) => void }) {
  const id = `cosmos-param-${def.key}`;
  if (def.kind === "toggle") {
    return (
      <label className="lq-dev-row lq-dev-toggle" htmlFor={id}>
        <span>{def.label}</span>
        <input id={id} type="checkbox" checked={value > 0} onChange={(event) => onChange(event.target.checked ? 1 : 0)} />
      </label>
    );
  }
  if (def.kind === "choice") {
    return (
      <label className="lq-dev-row" htmlFor={id}>
        <span>{def.label}</span>
        <select id={id} value={value} onChange={(event) => onChange(Number(event.target.value))}>
          {def.options?.map((name, index) => (
            <option key={name} value={index}>{name}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="lq-dev-row" htmlFor={id} title={def.hint}>
      <span>{def.label}</span>
      <output>{Number(value.toFixed(3))}</output>
      <input id={id} type="range" min={def.min} max={def.max} step={def.step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function CosmosDevPanel({ cosmos, params, onChange, onClose }: { cosmos: AsciiCosmos | null; params: CosmosParams; onChange: (next: CosmosParams) => void; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Clicks on the panel must not start the black hole underneath.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stop = (event: Event) => event.stopPropagation();
    root.addEventListener("pointerdown", stop);
    root.addEventListener("pointermove", stop);
    return () => {
      root.removeEventListener("pointerdown", stop);
      root.removeEventListener("pointermove", stop);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(changedParamsText(params));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy these values:", changedParamsText(params));
    }
  };

  return (
    <div className="lq-dev-panel" ref={rootRef} role="region" aria-label="ASCII scene developer panel">
      <header>
        <strong>ASCII scene · dev</strong>
        <button type="button" onClick={onClose} aria-label="Close developer panel">×</button>
      </header>
      <div className="lq-dev-actions">
        <button type="button" onClick={() => cosmos?.hold(cosmos.width / 2, cosmos.height * 0.62)}>Hold hole</button>
        <button type="button" onClick={() => cosmos?.release()}>Explode</button>
        <button type="button" onClick={() => cosmos?.showSystemNow()}>System now</button>
        <button type="button" onClick={() => { cosmos?.cancel(); }}>Cancel</button>
      </div>
      <div className="lq-dev-scroll">
        {GROUPS.map((group) => (
          <details key={group} open={group === "Characters"}>
            <summary>{group}</summary>
            {PARAM_DEFS.filter((def) => def.group === group).map((def) => (
              <ParamControl key={def.key} def={def} value={params[def.key as ParamKey]} onChange={(value) => onChange({ ...params, [def.key]: value })} />
            ))}
          </details>
        ))}
      </div>
      <footer>
        <button type="button" onClick={copy}>{copied ? "Copied" : "Copy changed values"}</button>
        <button type="button" onClick={() => onChange({ ...DEFAULT_PARAMS })}>Reset sliders</button>
      </footer>
    </div>
  );
}
