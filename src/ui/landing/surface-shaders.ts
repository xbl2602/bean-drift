// GPU programs (GLSL) for the hero: the view from someone standing on the lunar surface.
//
// The camera never moves, so the expensive part (finding where each pixel's line of sight meets
// the ground) is done ONCE into a "depth" image (MARCH pass). Every frame after that only does
// the lighting for the current Sun position (SHADE pass), which is what makes the shadows sweep.

import { GLSL_EARTH, GLSL_GLOBE, GLSL_NOISE, GLSL_STARS, GLSL_SUN_PHOTO } from "./shader-chunks";
import { FINE_TILE_M, MID_TILE_M } from "./surface-terrain";

const GLSL_TERRAIN_AND_CAMERA = `
uniform vec2 uResolution;      // drawing size in device pixels
uniform sampler2D uBase;       // real LOLA heights (metres, relative to the ground under the camera)
uniform sampler2D uMid;        // generated mid-size detail, repeating
uniform sampler2D uFine;       // generated close-up detail, repeating
uniform vec2 uBaseCorner;      // world x/z of the base map's north-west corner
uniform float uBaseSide;       // side length of the base map in metres
uniform vec2 uCamXZ;           // where the viewer stands (world metres: x east, z south)
uniform float uEyeHeight;      // metres above the ground
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uTanHalfFov;
uniform float uPixelAngle;     // angle covered by one pixel, in radians

const float MOON_RADIUS_M = 1737400.0;
const float NEAR_M = 0.05;
const float FAR_M = 34000.0;
const float DETAIL_TEXELS = 1024.0;   // side of the generated detail tiles, in samples

// How blurred a detail tile should be read: 0 = full sharpness, +1 per doubling of the ground area
// one sample has to stand for. Without this, fine detail far away turns into flickering dots.
float detailLevel(float footprintM, float tileM) {
  return log2(max(footprintM * DETAIL_TEXELS / tileM, 1.0));
}

// Ground height at a world position. footprintM says how wide a patch of ground the sample represents.
float terrainHeight(vec2 xz, float footprintM) {
  float dist = length(xz - uCamXZ);
  float h = textureLod(uBase, (xz - uBaseCorner) / uBaseSide, 0.0).r;
  h += textureLod(uMid, xz / ${MID_TILE_M.toFixed(1)}, detailLevel(footprintM, ${MID_TILE_M.toFixed(1)})).r * (1.0 - 0.55 * smoothstep(4000.0, 14000.0, dist));
  if (dist < 2600.0) {
    // The same tile again, smaller and turned, for craters a few metres to tens of metres wide.
    vec2 turned = mat2(0.8, -0.6, 0.6, 0.8) * xz;
    h += textureLod(uMid, turned / 610.0, detailLevel(footprintM, 610.0)).r * 0.22 * (1.0 - smoothstep(1300.0, 2600.0, dist));
  }
  if (dist < 280.0) {
    h += textureLod(uFine, xz / ${FINE_TILE_M.toFixed(1)}, detailLevel(footprintM, ${FINE_TILE_M.toFixed(1)})).r * (1.0 - smoothstep(130.0, 280.0, dist));
  }
  // The Moon is a small world: the ground visibly falls away with distance.
  return h - dist * dist / (2.0 * MOON_RADIUS_M);
}

vec3 cameraOrigin() {
  return vec3(uCamXZ.x, terrainHeight(uCamXZ, 0.0) + uEyeHeight, uCamXZ.y);
}

vec3 cameraRay(vec2 frag) {
  vec2 ndc = frag / uResolution * 2.0 - 1.0;
  float aspect = uResolution.x / uResolution.y;
  return normalize(uCamForward + uCamRight * (ndc.x * aspect * uTanHalfFov) + uCamUp * (ndc.y * uTanHalfFov));
}

// A distance in metres squeezed into three colour channels (and back), so it survives an 8-bit image.
vec3 packDistance(float t) {
  float v = clamp(log(t / NEAR_M) / log(FAR_M / NEAR_M), 0.0, 0.9999999);
  vec3 enc = fract(v * vec3(1.0, 255.0, 65025.0));
  enc.xy -= enc.yz / 255.0;
  return enc;
}

float unpackDistance(vec3 enc) {
  float v = dot(enc, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
  return NEAR_M * exp(v * log(FAR_M / NEAR_M));
}
`;

export const SURFACE_MARCH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform float uMaxHeight;      // highest terrain (metres, relative); nothing to hit above it
out vec4 outColor;
${GLSL_TERRAIN_AND_CAMERA}

void main() {
  vec3 origin = cameraOrigin();
  vec3 ray = cameraRay(gl_FragCoord.xy);

  // Walk along the line of sight. Steps are large high above the ground and small close to it.
  float t = 0.2;
  float previous = 0.0;
  bool hit = false;
  for (int i = 0; i < 1100; i++) {
    vec3 p = origin + ray * t;
    float above = p.y - terrainHeight(p.xz, t * uPixelAngle);
    if (above < 0.0) { hit = true; break; }
    if (t > FAR_M || (ray.y > 0.0 && p.y > uMaxHeight)) break;
    previous = t;
    // Varying the step a little per pixel turns visible stair-step rings into unnoticeable grain.
    t += max(above * 0.5, t * 0.006) * (0.7 + 0.3 * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453));
  }
  if (!hit) { outColor = vec4(0.0); return; }

  // Narrow down the exact crossing point between the last two steps.
  float low = previous;
  float high = t;
  for (int i = 0; i < 10; i++) {
    float mid = 0.5 * (low + high);
    vec3 p = origin + ray * mid;
    if (p.y - terrainHeight(p.xz, mid * uPixelAngle) < 0.0) high = mid; else low = mid;
  }
  outColor = vec4(packDistance(high), 1.0);
}
`;

export const SURFACE_SHADE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform float uPixelRatio;
uniform float uTime;
uniform float uStarDrift;
uniform sampler2D uDepth;        // result of the MARCH pass
uniform sampler2D uEarthColor;
uniform sampler2D uSunImage;
uniform vec3 uSunDir;            // world direction towards the Sun
uniform vec2 uSunCenter;         // device pixels, origin bottom-left
uniform float uSunRadius;
uniform vec2 uEarthCenter;
uniform float uEarthRadius;
uniform mat3 uEarthRotation;
uniform vec3 uEarthLight;
out vec4 outColor;
${GLSL_NOISE}
${GLSL_STARS}
${GLSL_GLOBE}
${GLSL_EARTH}
${GLSL_SUN_PHOTO}
${GLSL_TERRAIN_AND_CAMERA}

// 0 = the Sun is hidden from point p by terrain, 1 = fully visible; soft at the shadow's edge.
float sunShadow(vec3 p, float viewDistance, float footprintM) {
  if (uSunDir.y < -0.08) return 0.0;
  float lit = 1.0;
  // Each pixel starts its shadow ray a little differently, so the steps blend into fine grain
  // instead of forming stripes along gentle slopes.
  float s = max(0.06, viewDistance * 0.003) * (0.75 + 0.5 * hash21(gl_FragCoord.xy));
  for (int i = 0; i < 46; i++) {
    vec3 q = p + uSunDir * s;
    // Far along the shadow ray only big shapes matter, so read the ground more and more coarsely.
    float above = q.y - terrainHeight(q.xz, max(footprintM, s * 0.04));
    lit = min(lit, above * 55.0 / s);
    if (lit <= 0.0 || s > 26000.0) break;
    s *= 1.32;
  }
  return clamp(lit, 0.0, 1.0);
}

// How much of the Sun's disc is above the terrain as seen by the viewer (0..1).
float sunDiscVisibility() {
  if (uSunCenter.x < 0.0 || uSunCenter.y < 0.0 || uSunCenter.x >= uResolution.x || uSunCenter.y >= uResolution.y) {
    return uSunDir.y > 0.0 ? 1.0 : 0.0;
  }
  float covered = 0.0;
  for (int i = 0; i < 9; i++) {
    vec2 tap = vec2(float(i % 3) - 1.0, float(i / 3) - 1.0) * uSunRadius * 0.6;
    ivec2 texel = clamp(ivec2(uSunCenter + tap), ivec2(0), ivec2(uResolution) - 1);
    covered += texelFetch(uDepth, texel, 0).a;
  }
  return 1.0 - covered / 9.0;
}

vec3 shadeGround(vec3 origin, vec3 ray, float t) {
  vec3 p = origin + ray * t;
  // One pixel covers more ground the further away it is, and much more where we look along the
  // ground at a shallow angle; read the terrain at that scale so distant detail stays calm.
  float footprintM = t * uPixelAngle * 3.4;
  // At least two samples of the finest detail tile: any closer and the slope shows the tile's pixel grid.
  float e = max(0.16, footprintM);
  float slopeX = terrainHeight(p.xz + vec2(e, 0.0), footprintM) - terrainHeight(p.xz - vec2(e, 0.0), footprintM);
  float slopeZ = terrainHeight(p.xz + vec2(0.0, e), footprintM) - terrainHeight(p.xz - vec2(0.0, e), footprintM);
  vec3 normal = normalize(vec3(-slopeX, 2.0 * e, -slopeZ));

  float shadow = sunShadow(p + normal * (0.02 + t * 0.0008), t, footprintM);
  float towardSun = max(dot(normal, uSunDir), 0.0);
  float towardEye = max(dot(normal, -ray), 0.03);
  // Lunar dust reflects differently from a matte ball: it stays bright even at grazing angles.
  float dusty = 2.0 * towardSun / (towardSun + towardEye);
  float light = mix(towardSun, dusty, 0.5) * shadow;

  float broadDetail = 1.0 - smoothstep(20.0, 60.0, footprintM);
  float patches = mix(0.5, noise3(vec3(p.xz * 0.012, 3.0)), 0.6 * broadDetail);
  patches += (noise3(vec3(p.xz * 0.11, 7.0)) - 0.5) * 0.4 * (1.0 - smoothstep(2.0, 7.0, footprintM));
  vec3 dust = vec3(0.40, 0.385, 0.37) * (0.82 + 0.36 * patches);
  // Lift the darkest ground slightly so the foreground reads even when the Sun sets.
  vec3 earthshine = vec3(0.055, 0.064, 0.082);
  return dust * (light * 2.6 + earthshine);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec4 depth = texelFetch(uDepth, ivec2(frag), 0);
  float sunVisible = sunDiscVisibility();
  vec3 color;

  if (depth.a < 0.5) {
    // Sky: stars fade a little while the Sun is up, as they would for a camera.
    color = starField(frag / uPixelRatio, uStarDrift) * (1.0 - 0.45 * sunVisible);
    color = drawEarth(color, frag, uEarthCenter, uEarthRadius, uEarthRotation, uEarthLight);
    if (sunVisible > 0.0) color = drawSun(color, frag, uSunCenter, uSunRadius, sunVisible);
  } else {
    color = shadeGround(cameraOrigin(), cameraRay(frag), unpackDistance(depth.rgb));
    // A little lens glare spills over the ground near the Sun.
    color += sunGlow(frag - uSunCenter, uSunRadius) * 0.16 * sunVisible;
  }

  outColor = vec4(finishColor(color, frag), 1.0);
}
`;
