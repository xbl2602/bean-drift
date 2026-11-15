// 模拟器里数字的显示：按所选语言的格式写数字和日期，功率 / 电量 / 时长自动换成合适的单位。
import type { Locale } from "../settings/settings-store";
import type { Translate } from "../i18n/use-t";

const numberFormat = (locale: Locale, digits: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits });

export function formatNumber(locale: Locale, value: number, digits = 0): string {
  return numberFormat(locale, digits).format(value);
}

/** 350 W / 1.5 kW / 30 kW。 */
export function formatPower(locale: Locale, watts: number): string {
  return watts >= 1000 ? `${formatNumber(locale, watts / 1000, watts >= 10_000 ? 0 : 1)} kW` : `${formatNumber(locale, watts)} W`;
}

/** 900 Wh / 2.5 kWh / 300 kWh / 1.2 MWh。 */
export function formatEnergyKWh(locale: Locale, kWh: number): string {
  if (kWh >= 1000) return `${formatNumber(locale, kWh / 1000, 1)} MWh`;
  if (kWh < 1) return `${formatNumber(locale, kWh * 1000)} Wh`;
  return `${formatNumber(locale, kWh, kWh >= 100 ? 0 : 1)} kWh`;
}

/** 两天以内写小时，更长写天。 */
export function formatHours(locale: Locale, t: Translate, hours: number): string {
  if (!Number.isFinite(hours)) return t("sim.unlimited");
  return hours >= 48 ? t("sim.days", { n: formatNumber(locale, hours / 24, 1) }) : `${formatNumber(locale, hours, hours < 10 ? 1 : 0)} h`;
}

export function formatPercent(locale: Locale, fraction: number): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(fraction);
}

export function formatDataGB(locale: Locale, gb: number): string {
  return gb >= 1 ? `${formatNumber(locale, gb, 1)} GB` : `${formatNumber(locale, gb * 1024)} MB`;
}

/** 日期时间一律按 UTC 显示（和时间轴一致）。 */
export function formatUtc(locale: Locale, timeMs: number): string {
  return `${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(timeMs)} UTC`;
}

/** 任务第几天（着陆当天是第 1 天）。 */
export const missionDay = (startMs: number, timeMs: number) => Math.floor((timeMs - startMs) / 86_400_000) + 1;
