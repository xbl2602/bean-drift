// Draws the hero: the view from someone standing on the lunar surface, with the Sun and Earth in
// the sky. Directions use compass terms (azimuth: 0 = north, 90 = east; elevation: up from level),
// the same convention as the rest of the project.

import { buildFullscreenProgram, type CanvasRenderer, createFullscreenQuad, loadGlobeTexture } from "./gl-utils";
import { EARTH_TEXTURE_URL, SUN_IMAGE_URL } from "./space-renderer";
import { FXAA_FRAGMENT_SHADER, SURFACE_MARCH_FRAGMENT_SHADER, SURFACE_SHADE_FRAGMENT_SHADER } from "./surface-shaders";
import { loadSurfaceTerrain, type SurfaceTerrain } from "./surface-terrain";

type Vec3 = [number, number, number];

export type SurfaceCamera = {
  /** Where the viewer stands, in metres from the south pole (x east, z south). */
  xM: number;
  zM: number;
  eyeHeightM: number;
  /** Compass direction the viewer faces, and how far the gaze is tipped up, in degrees. */
  headingDeg: number;
  pitchDeg: number;
  /** Vertical field of view in degrees. */
  fovDeg: number;
};

export type SkyBody = { azimuthDeg: number; elevationDeg: number; angularRadiusDeg: number };

export type SurfaceScene = {
  timeS: number;
  starDriftPx: number;
  sun: SkyBody;
  earth: SkyBody;
  /** View -> Earth's own frame, column-major (see space-math.ts globeRotation). */
  earthRotation: Float32Array;
};

const TERRAIN_URL = "/landing/lola-south-pole-640.bin";
/** The ground is costly to draw, so the hero uses at most 1.5 device pixels per CSS pixel. */
const MAX_PIXEL_RATIO = 1.5;
const DEG = Math.PI / 180;

/** Compass direction -> world vector (x east, y up, z south). */
function directionFromCompass(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

function uploadHeightTexture(
  gl: WebGL2RenderingContext,
  unit: number,
  size: number,
  heights: Float32Array,
  repeat: boolean,
  withBlurLevels: boolean,
): WebGLTexture {
  // 32-bit heights need an optional browser feature to be blended smoothly; 16-bit always can be.
  const format = gl.getExtension("OES_texture_float_linear") ? gl.R32F : gl.R16F;
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, format, size, size, 0, gl.RED, gl.FLOAT, heights);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (withBlurLevels) {
    // Smaller, pre-averaged copies of the tile ("mip levels"), so distant ground can be read blurred.
    // The browser cannot build these itself for this kind of texture, so we average 2 x 2 blocks here.
    let level = heights;
    let levelSize = size;
    for (let index = 1; levelSize > 1; index++) {
      const half = levelSize / 2;
      const smaller = new Float32Array(half * half);
      for (let y = 0; y < half; y++) {
        for (let x = 0; x < half; x++) {
          const i = y * 2 * levelSize + x * 2;
          smaller[y * half + x] = 0.25 * (level[i] + level[i + 1] + level[i + levelSize] + level[i + levelSize + 1]);
        }
      }
      gl.texImage2D(gl.TEXTURE_2D, index, format, half, half, 0, gl.RED, gl.FLOAT, smaller);
      level = smaller;
      levelSize = half;
    }
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, withBlurLevels ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

// Texture units.
const UNIT_BASE = 0;
const UNIT_MID = 1;
const UNIT_FINE = 2;
const UNIT_DEPTH = 3;
const UNIT_EARTH = 4;
const UNIT_SCENE = 6;
const UNIT_SUN = 5;

/** Returns null when the browser has no WebGL2, so the caller can leave the plain background in place. */
export function createSurfaceRenderer(canvas: HTMLCanvasElement, camera: SurfaceCamera): CanvasRenderer<SurfaceScene> | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return null;

  const marchProgram = buildFullscreenProgram(gl, SURFACE_MARCH_FRAGMENT_SHADER);
  const shadeProgram = buildFullscreenProgram(gl, SURFACE_SHADE_FRAGMENT_SHADER);
  const fxaaProgram = buildFullscreenProgram(gl, FXAA_FRAGMENT_SHADER);
  const quad = createFullscreenQuad(gl);

  const forward = directionFromCompass(camera.headingDeg, camera.pitchDeg);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const tanHalfFov = Math.tan((camera.fovDeg * DEG) / 2);

  // The "depth" image the MARCH pass draws into: for each pixel, how far away the ground is.
  const depthTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + UNIT_DEPTH);
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const depthTarget = gl.createFramebuffer();

  // The finished picture is first drawn into this image, then an edge-smoothing pass (FXAA)
  // copies it to the canvas. The ground is shaded per pixel, so without this its edges stair-step.
  const sceneTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + UNIT_SCENE);
  gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const sceneTarget = gl.createFramebuffer();
  gl.useProgram(fxaaProgram);
  gl.uniform1i(gl.getUniformLocation(fxaaProgram, "uScene"), UNIT_SCENE);
  const fxaaInverseResolution = gl.getUniformLocation(fxaaProgram, "uInvRes");

  const earth = loadGlobeTexture(gl, UNIT_EARTH, EARTH_TEXTURE_URL);
  const sunImage = loadGlobeTexture(gl, UNIT_SUN, SUN_IMAGE_URL);
  const heightTextures: WebGLTexture[] = [];
  let terrain: SurfaceTerrain | null = null;
  let isDisposed = false;
  let depthIsStale = true;
  let depthWidth = 0;
  let depthHeight = 0;
  let pixelRatio = 1;

  const setSharedUniforms = (program: WebGLProgram, loaded: SurfaceTerrain) => {
    gl.useProgram(program);
    const at = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform1i(at("uBase"), UNIT_BASE);
    gl.uniform1i(at("uMid"), UNIT_MID);
    gl.uniform1i(at("uFine"), UNIT_FINE);
    gl.uniform2f(at("uBaseCorner"), loaded.baseCornerXM, loaded.baseCornerZM);
    gl.uniform1f(at("uBaseSide"), loaded.baseSideM);
    gl.uniform2f(at("uCamXZ"), camera.xM, camera.zM);
    gl.uniform1f(at("uEyeHeight"), camera.eyeHeightM);
    gl.uniform3fv(at("uCamRight"), right);
    gl.uniform3fv(at("uCamUp"), up);
    gl.uniform3fv(at("uCamForward"), forward);
    gl.uniform1f(at("uTanHalfFov"), tanHalfFov);
  };

  const terrainReady = loadSurfaceTerrain(TERRAIN_URL, camera.xM, camera.zM).then((loaded) => {
    if (isDisposed || gl.isContextLost()) return;
    heightTextures.push(
      uploadHeightTexture(gl, UNIT_BASE, loaded.baseSize, loaded.base, false, false),
      uploadHeightTexture(gl, UNIT_MID, loaded.detailSize, loaded.mid, true, true),
      uploadHeightTexture(gl, UNIT_FINE, loaded.detailSize, loaded.fine, true, true),
    );
    setSharedUniforms(marchProgram, loaded);
    gl.uniform1f(gl.getUniformLocation(marchProgram, "uMaxHeight"), loaded.maxHeightM);
    setSharedUniforms(shadeProgram, loaded);
    gl.uniform1i(gl.getUniformLocation(shadeProgram, "uDepth"), UNIT_DEPTH);
    gl.uniform1i(gl.getUniformLocation(shadeProgram, "uEarthColor"), UNIT_EARTH);
    gl.uniform1i(gl.getUniformLocation(shadeProgram, "uSunImage"), UNIT_SUN);
    terrain = loaded;
    depthIsStale = true;
  });

  const shade = (name: string) => gl.getUniformLocation(shadeProgram, name);
  const locations = {
    marchResolution: gl.getUniformLocation(marchProgram, "uResolution"),
    marchPixelAngle: gl.getUniformLocation(marchProgram, "uPixelAngle"),
    pixelAngle: shade("uPixelAngle"),
    resolution: shade("uResolution"),
    pixelRatio: shade("uPixelRatio"),
    time: shade("uTime"),
    starDrift: shade("uStarDrift"),
    sunDir: shade("uSunDir"),
    earthDir: shade("uEarthDir"),
    sunCenter: shade("uSunCenter"),
    sunRadius: shade("uSunRadius"),
    earthCenter: shade("uEarthCenter"),
    earthRadius: shade("uEarthRadius"),
    earthRotation: shade("uEarthRotation"),
    earthLight: shade("uEarthLight"),
  };

  /** Where a sky direction lands on the canvas (device pixels, origin bottom-left) and how big it looks. */
  const projectSkyBody = (body: SkyBody) => {
    const direction = directionFromCompass(body.azimuthDeg, body.elevationDeg);
    const depth = dot(direction, forward);
    if (depth < 0.05) return { direction, x: -1e6, y: -1e6, radius: 1 }; // behind the viewer
    const aspect = canvas.width / canvas.height;
    const x = (dot(direction, right) / (depth * tanHalfFov * aspect) * 0.5 + 0.5) * canvas.width;
    const y = (dot(direction, up) / (depth * tanHalfFov) * 0.5 + 0.5) * canvas.height;
    const radius = (Math.tan(body.angularRadiusDeg * DEG) / tanHalfFov) * (canvas.height / 2);
    return { direction, x, y, radius };
  };

  return {
    ready: Promise.all([terrainReady, earth.loaded, sunImage.loaded]).then(() => undefined),

    resize() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const widthPx = canvas.clientWidth;
      const heightPx = canvas.clientHeight;
      const bufferWidth = Math.max(1, Math.round(widthPx * pixelRatio));
      const bufferHeight = Math.max(1, Math.round(heightPx * pixelRatio));
      if (canvas.width !== bufferWidth) canvas.width = bufferWidth;
      if (canvas.height !== bufferHeight) canvas.height = bufferHeight;
      // Compare with the size of OUR depth image, not the canvas: if this component mounts twice on
      // the same canvas (React does that in development), the canvas is already the right size.
      if (depthWidth !== bufferWidth || depthHeight !== bufferHeight) {
        depthWidth = bufferWidth;
        depthHeight = bufferHeight;
        gl.activeTexture(gl.TEXTURE0 + UNIT_DEPTH);
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bufferWidth, bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.activeTexture(gl.TEXTURE0 + UNIT_SCENE);
        gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bufferWidth, bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        depthIsStale = true;
      }
      return { widthPx, heightPx };
    },

    render(scene) {
      if (!terrain || gl.isContextLost()) return;

      if (depthIsStale) {
        // The one-off expensive pass; it only runs again if the canvas changes size.
        gl.bindFramebuffer(gl.FRAMEBUFFER, depthTarget);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, depthTexture, 0);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(marchProgram);
        gl.uniform2f(locations.marchResolution, canvas.width, canvas.height);
        gl.uniform1f(locations.marchPixelAngle, (2 * tanHalfFov) / canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        depthIsStale = false;
      }

      const sun = projectSkyBody(scene.sun);
      const earthOnScreen = projectSkyBody(scene.earth);
      // Sunlight on the Earth, in view space (z towards the viewer). The small push towards the
      // viewer keeps more of the Earth lit than strict geometry would; it is a look choice.
      const earthLight = normalize([dot(sun.direction, right), dot(sun.direction, up), -dot(sun.direction, forward) + 0.95]);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(shadeProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget);
      gl.uniform2f(locations.resolution, canvas.width, canvas.height);
      gl.uniform1f(locations.pixelRatio, pixelRatio);
      gl.uniform1f(locations.pixelAngle, (2 * tanHalfFov) / canvas.height);
      gl.uniform1f(locations.time, scene.timeS);
      gl.uniform1f(locations.starDrift, scene.starDriftPx);
      gl.uniform3fv(locations.sunDir, sun.direction);
      gl.uniform3fv(locations.earthDir, earthOnScreen.direction);
      gl.uniform2f(locations.sunCenter, sun.x, sun.y);
      gl.uniform1f(locations.sunRadius, sun.radius);
      gl.uniform2f(locations.earthCenter, earthOnScreen.x, earthOnScreen.y);
      gl.uniform1f(locations.earthRadius, earthOnScreen.radius);
      gl.uniformMatrix3fv(locations.earthRotation, false, scene.earthRotation);
      gl.uniform3fv(locations.earthLight, earthLight);
      gl.drawArrays(gl.TRIANGLES, 0, 6); // the picture, into the scene image
      // Smooth the stair-stepped edges while copying it to the canvas.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(fxaaProgram);
      gl.uniform2f(fxaaInverseResolution, 1 / canvas.width, 1 / canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    dispose() {
      // Free our GPU objects but keep the context alive (see space-renderer.ts for why).
      isDisposed = true;
      heightTextures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteTexture(depthTexture);
      gl.deleteTexture(sceneTexture);
      gl.deleteFramebuffer(sceneTarget);
      gl.deleteProgram(fxaaProgram);
      gl.deleteTexture(earth.texture);
      gl.deleteTexture(sunImage.texture);
      gl.deleteFramebuffer(depthTarget);
      gl.deleteBuffer(quad);
      gl.deleteProgram(marchProgram);
      gl.deleteProgram(shadeProgram);
    },
  };
}
