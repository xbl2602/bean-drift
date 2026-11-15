"use client";
// 模拟器第 2 步：选任务类型、时长、开始时间、设备（太阳能板 / 电池 / 核电源 / 乘员）和对地通信要求。
// 选了任务类型就填好这类任务的典型数值，用户可以再改。
import type { ReactNode } from "react";
import { useLocale, useT } from "../i18n/use-t";
import { DURATION_CHOICES_DAYS, EARTH_ELEVATION_CHOICES, MISSION_TYPES, NUCLEAR_CHOICES_W, defaultConfig, operatingLoadW, survivalLoadW, type MissionConfig, type MissionTypeId } from "./mission-presets";
import { formatPower } from "./mission-format";

const MIN_START_MS = Date.UTC(2000, 0, 1);
const MAX_START_MS = Date.UTC(2099, 0, 1);
const MAX_CREW = 12;

interface MissionSetupFormProps {
  config: MissionConfig;
  onChange: (config: MissionConfig) => void;
  mapTimeMs: number;
}

export function MissionSetupForm({ config, onChange, mapTimeMs }: MissionSetupFormProps) {
  const t = useT();
  const locale = useLocale();
  const set = (change: Partial<MissionConfig>) => onChange({ ...config, ...change });
  const pickType = (id: MissionTypeId) => {
    if (id !== config.type) onChange({ ...defaultConfig(id, config.startMs), minEarthElevationDeg: config.minEarthElevationDeg });
  };

  return (
    <div className="space-y-4">
      <Field label={t("sim.missionType")}>
        <div className="grid grid-cols-2 gap-1.5">
          {MISSION_TYPES.map((type) => {
            const active = type.id === config.type;
            return (
              <button
                key={type.id}
                type="button"
                aria-pressed={active}
                onClick={() => pickType(type.id)}
                className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition ${active ? "border-lime-300/70 bg-lime-300/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"} ${type.id === "outpost" ? "col-span-2" : ""}`}
              >
                <svg viewBox="0 0 24 24" className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-lime-300" : "text-white/60"}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={type.icon} /></svg>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-white">{t(`sim.type.${type.id}`)}</span>
                  <span className="block text-[11px] leading-snug text-white/55">{t(`sim.type.${type.id}.desc`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t("sim.duration")}>
        <Chips
          options={DURATION_CHOICES_DAYS}
          value={config.durationDays}
          onChange={(durationDays) => set({ durationDays })}
          label={(days) => (days === 365 ? t("sim.oneYear") : t("sim.days", { n: days }))}
        />
      </Field>

      <Field label={t("sim.start")}>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={new Date(config.startMs).toISOString().slice(0, 16)}
            min="2000-01-01T00:00"
            max="2099-01-01T00:00"
            onChange={(event) => {
              const ms = Date.parse(`${event.target.value}:00Z`);
              if (Number.isFinite(ms)) set({ startMs: Math.min(MAX_START_MS, Math.max(MIN_START_MS, ms)) });
            }}
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-xs text-white focus:border-lime-300/60 focus:outline-none"
          />
          <button type="button" onClick={() => set({ startMs: Math.min(MAX_START_MS, Math.max(MIN_START_MS, mapTimeMs)) })} className="shrink-0 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-white/80 hover:bg-white/10">
            {t("sim.useMapTime")}
          </button>
        </div>
      </Field>

      <Field label={t("sim.requirements")}>
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <NumberRow label={t("sim.solar")} unit="W" value={config.solarW} step={100} max={200_000} onChange={(solarW) => set({ solarW })} />
          <NumberRow label={t("sim.battery")} unit="kWh" value={config.batteryWh / 1000} step={0.5} max={5_000} onChange={(kWh) => set({ batteryWh: Math.round(kWh * 1000) })} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/75">{t("sim.nuclear")}</span>
            <select
              value={config.nuclearW}
              onChange={(event) => set({ nuclearW: Number(event.target.value) })}
              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white focus:border-lime-300/60 focus:outline-none"
            >
              {[...new Set([...NUCLEAR_CHOICES_W, config.nuclearW])].sort((a, b) => a - b).map((watts) => (
                <option key={watts} value={watts}>{watts === 0 ? t("sim.none") : formatPower(locale, watts)}</option>
              ))}
            </select>
          </div>
          {config.crewed && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/75">{t("sim.crew")}</span>
              <div className="flex items-center gap-1">
                <StepButton label="−" disabled={config.crew <= 1} onClick={() => set({ crew: config.crew - 1 })} />
                <span className="min-w-16 whitespace-nowrap px-1 text-center text-xs tabular-nums text-white">{t("sim.people", { n: config.crew })}</span>
                <StepButton label="+" disabled={config.crew >= MAX_CREW} onClick={() => set({ crew: config.crew + 1 })} />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/75">{t("sim.earthLink")}</span>
            <select
              value={config.minEarthElevationDeg ?? ""}
              onChange={(event) => set({ minEarthElevationDeg: event.target.value === "" ? null : Number(event.target.value) })}
              className="max-w-[11rem] rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white focus:border-lime-300/60 focus:outline-none"
            >
              {EARTH_ELEVATION_CHOICES.map((deg) => (
                <option key={deg ?? "terrain"} value={deg ?? ""}>{deg === null ? t("sim.terrainOnly") : t("sim.degrees", { n: deg })}</option>
              ))}
            </select>
          </div>
          <p className="border-t border-white/10 pt-2 text-[11px] leading-snug text-white/60">
            {t("sim.load", { operating: formatPower(locale, operatingLoadW(config)), survival: formatPower(locale, survivalLoadW(config)) })}
          </p>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-white/45">{t("sim.typical")}</p>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
      {children}
    </div>
  );
}

function Chips<T extends number>({ options, value, onChange, label }: { options: T[]; value: T; onChange: (value: T) => void; label: (value: T) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={`rounded-full border px-2.5 py-1 text-xs transition ${option === value ? "border-lime-300 bg-lime-300 font-medium text-black" : "border-white/15 text-white/80 hover:bg-white/10"}`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

function NumberRow({ label, unit, value, step, max, onChange }: { label: string; unit: string; value: number; step: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/75">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          value={Number(value.toFixed(2))}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(0, next)));
          }}
          className="w-24 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-right font-mono text-xs text-white focus:border-lime-300/60 focus:outline-none"
        />
        <span className="w-8 text-[11px] text-white/55">{unit}</span>
      </span>
    </label>
  );
}

function StepButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="grid h-6 w-6 place-items-center rounded-full border border-white/15 text-sm text-white/85 hover:bg-white/10 disabled:opacity-30">
      {label}
    </button>
  );
}
