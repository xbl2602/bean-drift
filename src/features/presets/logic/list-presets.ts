import { z } from "zod";
import { listPresets } from "@/core/data";
import type { Preset } from "@/core/types";

export const listPresetsInputSchema = z.object({});

export function listPresetsForQuery(): { presets: readonly Preset[] } {
  return { presets: listPresets() };
}
