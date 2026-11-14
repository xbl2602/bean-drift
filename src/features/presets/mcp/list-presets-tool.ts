import { defineReadTool } from "@/core/tool";
import { listPresetsForQuery, listPresetsInputSchema } from "../logic/list-presets";

export const listPresetsTool = defineReadTool({
  name: "list_presets",
  description: "List preset lunar surface locations (id, name, latitude/longitude and where the coordinates came from).",
  access: "read",
  inputSchema: listPresetsInputSchema,
  run: listPresetsForQuery,
});
