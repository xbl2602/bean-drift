"use client";
// 模拟器第 2 步：选任务类型、时长、开始时间、设备（太阳能板 / 电池 / 核电源 / 乘员）和对地通信要求。
// 选了任务类型就填好这类任务的典型数值，用户可以再改。开始时间和设备都用和时间轴一样的滚轮来选。
import type { ReactNode } from "react";
import { useLocale, useT } from "../i18n/use-t";
import { DateTimePicker } from "../timeline/date-time-picker";
import { TimeWheel } from "../timeline/time-wheel";
import { BATTERY_CHOICES_WH, DURATION_CHOICES_DAYS, EARTH_ELEVATION_CHOICES, MAX_CREW, MISSION_TYPES, NUCLEAR_CHOICES_W, SOLAR_CHOICES_W, defaultConfig, operatingLoadW, survivalLoadW, type MissionConfig, type MissionTypeId } from "./mission-presets";
import { formatEnergyKWh, formatPower } from "./mission-format";

const MIN_START_MS = Date.UTC(2000, 0, 1);
const MAX_START_MS = Date.UTC(2099, 0, 1);
const CREW_CHOICES = Array.from({ length: MAX_CREW }, (_, i) => i + 1);
/** 滚轮上"地球高度"那一列：空字符串 = 不要求高度（只看地形遮挡）。 */
const ANY_HEIGHT = "";

const clampStart = (ms: number) => Math.min(MAX_START_MS, Math.max(MIN_START_MS, ms));
/** 滚轮的选项：固定的一串数值，再补上当前值（各任务类型的默认值、用户以前填的值），从小到大排好。 */
const wheelValues = (choices: readonly number[], current: number) => [...new Set([...choices, current])].sort((a, b) => a - b).map(String);

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
          <DateTimePicker variant="field" timeMs={config.startMs} onApply={(ms) => set({ startMs: clampStart(ms) })} />
          <button type="button" onClick={() => set({ startMs: clampStart(mapTimeMs) })} className="shrink-0 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-white/80 hover:bg-white/10">
            {t("sim.useMapTime")}
          </button>
        </div>
      </Field>

      <Field label={t("sim.requirements")}>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <p className="mb-2 text-[11px] text-white/50">{t("sim.scrollToChoose")}</p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-3">
            <TimeWheel label={t("sim.solar")} rows={3} value={config.solarW} values={wheelValues(SOLAR_CHOICES_W, config.solarW)} onChange={(w) => set({ solarW: Number(w) })} format={(w) => formatPower(locale, Number(w))} />
            <TimeWheel label={t("sim.battery")} rows={3} value={config.batteryWh} values={wheelValues(BATTERY_CHOICES_WH, config.batteryWh)} onChange={(wh) => set({ batteryWh: Number(wh) })} format={(wh) => formatEnergyKWh(locale, Number(wh) / 1000)} />
            <TimeWheel label={t("sim.nuclear")} rows={3} value={config.nuclearW} values={wheelValues(NUCLEAR_CHOICES_W, config.nuclearW)} onChange={(w) => set({ nuclearW: Number(w) })} format={(w) => (w === "0" ? t("sim.none") : formatPower(locale, Number(w)))} />
            <TimeWheel
              label={t("sim.earthLink")}
              rows={3}
              value={config.minEarthElevationDeg ?? ANY_HEIGHT}
              values={EARTH_ELEVATION_CHOICES.map((deg) => (deg === null ? ANY_HEIGHT : String(deg)))}
              onChange={(deg) => set({ minEarthElevationDeg: deg === ANY_HEIGHT ? null : Number(deg) })}
              format={(deg) => (deg === ANY_HEIGHT ? t("sim.terrainOnly") : `${deg}°`)}
            />
            {config.crewed && <TimeWheel label={t("sim.crew")} rows={3} value={config.crew} values={CREW_CHOICES.map(String)} onChange={(n) => set({ crew: Number(n) })} format={(n) => n} />}
          </div>
          <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-snug text-white/60">
            {t("sim.load", { operating: formatPower(locale, operatingLoadW(config)), survival: formatPower(locale, survivalLoadW(config)) })}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-white/45">{t("sim.earthNote")}</p>
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
