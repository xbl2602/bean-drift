"use client";

// Backdrop for the console section (decoration only, no text): a relay satellite in low lunar orbit,
// seen from a chase camera. The Moon fills the left and bottom, the Earth hangs at the upper right,
// and glowing links join the satellite to the Earth and to the surface bases it can really see.
// The picture stays pinned behind the page while you scroll through the section and dims once the
// cards arrive, so it never competes with their text. The scene itself is in lunar-orbit-scene.ts.

import { useRef } from "react";
import { createLunarOrbitRenderer } from "./lunar-orbit-scene";
import { useAnimatedCanvas } from "./use-animated-canvas";

const identity = (timeS: number) => timeS;

export function AnalysisNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useAnimatedCanvas(canvasRef, createLunarOrbitRenderer, identity, 40, true);

  return (
    <div className="lq-analysis-track" aria-hidden="true">
      <div className="lq-analysis-pin">
        <div className="lq-comms-stage">
          <canvas className="lq-space-canvas lq-orbit-canvas" ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
