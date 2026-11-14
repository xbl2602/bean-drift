// Draws the scroll story's space scene (stars + Moon / Earth / Sun) into a canvas using WebGL2.
// Callers describe the scene in CSS pixels with y pointing down, like the rest of the page;
// this file handles device pixels, textures and talking to the GPU.

import { buildFullscreenProgram, type CanvasRenderer, createFullscreenQuad, loadGlobeTexture } from "./gl-utils";
import { SPACE_FRAGMENT_SHADER } from "./space-shaders";

export type BodyKind = "moon" | "earth" | "sun";

export type SpaceBody = {
  kind: BodyKind;
  /** Centre in CSS pixels from the canvas's top-left corner. */
  xPx: number;
  yPx: number;
  radiusPx: number;
  /** 3x3 matrix (column-major) turning view directions into the body's own frame; see space-math.ts. */
  rotation: Float32Array;
  /** Direction towards the Sun in view space: x right, y up, z towards the viewer. */
  light: [number, number, number];
};

export type SpaceScene = {
  timeS: number;
  starDriftPx: number;
  /** Listed back to front: later bodies cover earlier ones. At most 3. */
  bodies: SpaceBody[];
};

const MAX_BODIES = 3;
const MAX_PIXEL_RATIO = 2;
const KIND_INDEX: Record<BodyKind, number> = { moon: 0, earth: 1, sun: 2 };

export const EARTH_TEXTURE_URL = "/landing/earth-blue-marble-2k.jpg";
const TEXTURE_URLS = {
  uMoonColor: "/landing/moon-color-4k.jpg",
  uMoonHeight: "/landing/moon-height-1k.jpg",
  uEarthColor: EARTH_TEXTURE_URL,
} as const;

/** Returns null when the browser has no WebGL2, so the caller can leave the plain background in place. */
export function createSpaceRenderer(canvas: HTMLCanvasElement): CanvasRenderer<SpaceScene> | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return null;

  const program = buildFullscreenProgram(gl, SPACE_FRAGMENT_SHADER);
  gl.useProgram(program);
  const quad = createFullscreenQuad(gl);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const locations = {
    pixelRatio: uniform("uPixelRatio"),
    time: uniform("uTime"),
    starDrift: uniform("uStarDrift"),
    count: uniform("uCount"),
    kind: uniform("uKind"),
    center: uniform("uCenter"),
    radius: uniform("uRadius"),
    rotation: uniform("uRotation"),
    light: uniform("uLight"),
  };

  const textureLoads = Object.entries(TEXTURE_URLS).map(([uniformName, url], unit) => {
    gl.uniform1i(uniform(uniformName), unit);
    return loadGlobeTexture(gl, unit, url);
  });
  const textures = textureLoads.map((load) => load.texture);
  const ready = Promise.all(textureLoads.map((load) => load.loaded)).then(() => undefined);

  const kinds = new Int32Array(MAX_BODIES);
  const centers = new Float32Array(MAX_BODIES * 2);
  const radii = new Float32Array(MAX_BODIES);
  const rotations = new Float32Array(MAX_BODIES * 9);
  const lights = new Float32Array(MAX_BODIES * 3);
  let pixelRatio = 1;
  let heightPx = 0;

  return {
    ready,

    resize() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const widthPx = canvas.clientWidth;
      heightPx = canvas.clientHeight;
      const bufferWidth = Math.max(1, Math.round(widthPx * pixelRatio));
      const bufferHeight = Math.max(1, Math.round(heightPx * pixelRatio));
      if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
        canvas.width = bufferWidth;
        canvas.height = bufferHeight;
        gl.viewport(0, 0, bufferWidth, bufferHeight);
      }
      return { widthPx, heightPx };
    },

    render(scene) {
      if (gl.isContextLost()) return;
      const count = Math.min(scene.bodies.length, MAX_BODIES);
      for (let i = 0; i < count; i++) {
        const body = scene.bodies[i];
        kinds[i] = KIND_INDEX[body.kind];
        centers[i * 2] = body.xPx * pixelRatio;
        centers[i * 2 + 1] = (heightPx - body.yPx) * pixelRatio; // GPU y runs upwards
        radii[i] = body.radiusPx * pixelRatio;
        rotations.set(body.rotation, i * 9);
        lights.set(body.light, i * 3);
      }
      gl.uniform1f(locations.pixelRatio, pixelRatio);
      gl.uniform1f(locations.time, scene.timeS);
      gl.uniform1f(locations.starDrift, scene.starDriftPx);
      gl.uniform1i(locations.count, count);
      gl.uniform1iv(locations.kind, kinds);
      gl.uniform2fv(locations.center, centers);
      gl.uniform1fv(locations.radius, radii);
      gl.uniformMatrix3fv(locations.rotation, false, rotations);
      gl.uniform3fv(locations.light, lights);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    dispose() {
      // Free our GPU objects but keep the context alive: a canvas hands back the same context if
      // the component mounts again (React does this in development), and a lost one cannot be reused.
      textures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
    },
  };
}
