// Loads the hero's ground. The heavy generation lives in surface-terrain-generate.ts and runs
// inside a Web Worker (spawned here), so the main thread stays free to hydrate and paint during
// the page's first seconds. Falls back to inline computation when a worker cannot be created.

import { buildSurfaceTerrainFromBytes, type SurfaceTerrain } from "./surface-terrain-generate";

export type { SurfaceTerrain };

type WorkerRequest = { url: string; cameraXM: number; cameraZM: number };
type WorkerReply = { terrain: SurfaceTerrain } | { error: string };

/** The one entry point renderers call: fetch + generation in a worker; same result as inline. */
export function loadSurfaceTerrain(url: string, cameraXM: number, cameraZM: number): Promise<SurfaceTerrain> {
  const inline = () => buildSurfaceTerrainFromBytes(url, cameraXM, cameraZM);
  if (typeof Worker === "undefined") return inline();
  try {
    const worker = new Worker(new URL("./surface-terrain.worker.ts", import.meta.url));
    return new Promise<SurfaceTerrain>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        worker.terminate();
        if ("error" in event.data) reject(new Error(event.data.error));
        else resolve(event.data.terrain);
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(`Terrain worker failed: ${event.message}`));
      };
      const request: WorkerRequest = { url, cameraXM, cameraZM };
      worker.postMessage(request);
    }).catch((error: unknown) => {
      console.error("Terrain worker failed, building on the main thread instead:", error);
      return inline();
    });
  } catch {
    return inline();
  }
}
