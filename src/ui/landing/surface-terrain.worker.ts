// Worker for surface-terrain.ts: fetches the LOLA crop and generates the ground tiles off the
// main thread, so the page's first seconds are never frozen by terrain generation.
// See surface-terrain.ts for what the tiles contain and why they are generated in code.

import { buildSurfaceTerrainFromBytes, type SurfaceTerrain } from "./surface-terrain-generate";

type WorkerRequest = { url: string; cameraXM: number; cameraZM: number };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { url, cameraXM, cameraZM } = event.data;
  try {
    const terrain = await buildSurfaceTerrainFromBytes(url, cameraXM, cameraZM);
    // Transfer the height buffers instead of copying them: together they are tens of megabytes.
    const transfer: Transferable[] = [terrain.base.buffer, terrain.mid.buffer, terrain.fine.buffer];
    (self as unknown as { postMessage: (message: unknown, transfer: Transferable[]) => void }).postMessage(
      { terrain },
      transfer,
    );
  } catch (error: unknown) {
    (self as unknown as { postMessage: (message: unknown) => void }).postMessage({ error: String(error) });
  }
};

// Re-exported for type checking only; never used at runtime here.
export type { SurfaceTerrain };
