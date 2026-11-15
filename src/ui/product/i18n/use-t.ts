"use client";
// 界面翻译：t("key", { n: 3 }) 取当前语言的文字，把 {n} 换成值。语言跟着设置走（settings/settings-store.ts）。
import { useCallback } from "react";
import { useSettings, type Locale } from "../settings/settings-store";
import { en, type MessageKey } from "./messages-en";
import { fr } from "./messages-fr";
import { ja } from "./messages-ja";
import { zhHans } from "./messages-zh";

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, "zh-Hans": zhHans, fr, ja };

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: MessageKey, values?: Record<string, string | number>): string {
  const text = MESSAGES[locale][key] ?? en[key];
  return values ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match)) : text;
}

export function useT(): Translate {
  const { locale } = useSettings();
  return useCallback((key, values) => translate(locale, key, values), [locale]);
}

export function useLocale(): Locale {
  return useSettings().locale;
}
