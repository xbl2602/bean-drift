// The Moon for the console backdrop: a sphere shaded by a custom shader.
//
// Far away it is the NASA colour map with relief from the LOLA elevation map. Close to the camera,
// where those maps run out of detail (one map texel is about 2.7 km), the shader adds real-looking
// ground from two pre-rendered terrain pictures (bake-lunar-detail.mjs): one covers 120 km square at
// ~117 m per pixel, the other 480 km at ~470 m per pixel. Craters in them follow measured lunar
// statistics (size distribution, depth-to-diameter ratio, ageing, ejecta). Reading a picture costs a
// few texture fetches, so there is no per-pixel crater maths; mip levels fade the detail out with distance.
//
// The Sun is one fixed direction, given in the Moon's own frame by the page each frame. Because it is
// low over the horizon, the ground casts real shadows: each pixel looks a few kilometres towards the Sun
// across the terrain heights, and is dark if something taller is in the way.

import type * as ThreeNamespace from "three";

export type MoonMaterialInputs = {
  color: ThreeNamespace.Texture;
  relief: ThreeNamespace.Texture;
  detailA: ThreeNamespace.Texture;
  detailB: ThreeNamespace.Texture;
};

const VERTEX_SHADER = /* glsl */ `
varying vec3 vObj;
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec3 vObj;
uniform sampler2D uColor;
uniform sampler2D uRelief;
uniform sampler2D uDetailA;
uniform sampler2D uDetailB;
uniform vec3 uSunObj;    // direction towards the Sun, in the Moon's frame
uniform vec3 uCamObj;    // camera position, in the Moon's frame (scene units)
uniform float uRadius;   // scene radius of the Moon
uniform float uExposure;

const float PI = 3.14159265;
const float R_KM = 1737.4;
const float TILES_A = 91.0;   // tiles of picture A around the equator (about 120 km each)
const float TILES_B = 23.0;   // tiles of picture B around the equator (about 475 km each)
const float L_A = 120.0;
const float L_B = 480.0;
const float RANGE_A = 3.0;    // the height pictures store +-3 km and +-9 km
const float RANGE_B = 9.0;
const float SQRT5 = 2.2360680;

// Picture coordinates for a (longitude, latitude) in radians. The tiles wrap exactly once per
// revolution in longitude, so there is no seam where the map ends.
vec2 uvA(vec2 ll) { return vec2(ll.x / (2.0 * PI) * TILES_A, ll.y * R_KM / L_A); }
vec2 uvA2(vec2 ll) { vec2 p = uvA(ll); return vec2(2.0 * p.x + p.y, -p.x + 2.0 * p.y) + vec2(0.37, 0.61); } // the same picture, turned and 2.24x smaller
vec2 uvB(vec2 ll) { return vec2(ll.x / (2.0 * PI) * TILES_B, ll.y * R_KM / L_B) + vec2(0.21, 0.43); }

float decodeHeight(vec3 texel, float range) {
  float v = (texel.r * 255.0 * 256.0 + texel.g * 255.0) / 65535.0;
  return (v * 2.0 - 1.0) * range;
}

// Terrain height in km at a place, from the three terrain layers added together (2nd copy of A at 0.6 strength).
float terrainHeight(vec2 ll, float lodA, float lodB) {
  float a1 = decodeHeight(textureLod(uDetailA, uvA(ll), lodA).rgb, RANGE_A);
  float a2 = decodeHeight(textureLod(uDetailA, uvA2(ll), lodA).rgb, RANGE_A) / SQRT5;
  float b = decodeHeight(textureLod(uDetailB, uvB(ll), lodB).rgb, RANGE_B);
  return a1 + 0.6 * a2 + b;
}

void main() {
  vec3 n0 = normalize(vObj);
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), n0) + vec3(1e-6, 0.0, 0.0));
  vec3 north = cross(n0, east);
  float lon = atan(n0.x, n0.z);
  float lat = asin(clamp(n0.y, -1.0, 1.0));
  float cosLat = max(cos(lat), 0.08);
  vec2 ll = vec2(lon, lat);
  vec2 mapUv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);

  // How many kilometres of ground one screen pixel covers (smooth across the map seam, unlike lon/lat).
  float km = R_KM / uRadius;
  float footprint = sqrt(max(length(dFdx(vObj)) * length(dFdy(vObj)), 1e-12)) * km;
  float lodMap = max(0.0, log2(footprint / 2.66));
  float lodA = clamp(log2(footprint / (L_A / 1024.0)), 0.0, 10.0);
  float lodB = clamp(log2(footprint / (L_B / 1024.0)), 0.0, 10.0);

  vec3 albedo = textureLod(uColor, mapUv, lodMap).rgb;

  // Large shapes: slope from the elevation map, measured across neighbouring texels.
  vec2 texel = vec2(1.0 / 4096.0, 1.0 / 2048.0);
  float metresPerStep = 255.0 * 1800.0 / 127.0;
  float dhEast = (textureLod(uRelief, mapUv + vec2(texel.x, 0.0), lodMap).r - textureLod(uRelief, mapUv - vec2(texel.x, 0.0), lodMap).r) * metresPerStep;
  float dhNorth = (textureLod(uRelief, mapUv + vec2(0.0, texel.y), lodMap).r - textureLod(uRelief, mapUv - vec2(0.0, texel.y), lodMap).r) * metresPerStep;
  float slopeEast = dhEast / (2.0 * texel.x * 2.0 * PI * 1737400.0 * cosLat);
  float slopeNorth = dhNorth / (2.0 * texel.y * PI * 1737400.0);
  vec2 slope = 2.2 * vec2(slopeEast, slopeNorth);

  // Close-up ground: slopes from the terrain pictures. The step is one texel of the mip level in use.
  float stepA = (L_A / 1024.0) * exp2(lodA);
  float stepB = (L_B / 1024.0) * exp2(lodB);
  float step = max(stepA, 0.05);
  vec2 dLL = vec2(step / (R_KM * cosLat), step / R_KM);
  float hE = terrainHeight(ll + vec2(dLL.x, 0.0), lodA, lodB) - terrainHeight(ll - vec2(dLL.x, 0.0), lodA, lodB);
  float hN = terrainHeight(ll + vec2(0.0, dLL.y), lodA, lodB) - terrainHeight(ll - vec2(0.0, dLL.y), lodA, lodB);
  slope += vec2(hE, hN) / (2.0 * step);
  float h0 = terrainHeight(ll, lodA, lodB);

  // Brightness of the ground: fresh bright ejecta, dark flooded floors, shade in crevices.
  float bA = 0.5 + 1.25 * textureLod(uDetailA, uvA(ll), lodA).b;
  float bA2 = 0.5 + 1.25 * textureLod(uDetailA, uvA2(ll), lodA).b;
  float bB = 0.5 + 1.25 * textureLod(uDetailB, uvB(ll), lodB).b;
  float tone = bA * mix(1.0, bA2, 0.5) * bB;

  vec3 normal = normalize(n0 - slope.x * east - slope.y * north);
  vec3 sun = normalize(uSunObj);
  vec3 view = normalize(uCamObj - vObj);
  float nl = max(dot(normal, sun), 0.0);
  float nv = max(dot(normal, view), 0.03);
  // Lunar dust stays bright even when the light is grazing.
  float lommel = 2.0 * nl / (nl + nv);
  float sunUp = dot(n0, sun);
  float daylight = smoothstep(-0.04, 0.08, sunUp);
  float light = mix(nl, lommel, 0.55) * daylight;

  // Cast shadows: look towards the Sun across the terrain; something taller than the sight line blocks it.
  vec3 sunLocal = vec3(dot(sun, east), dot(sun, north), sunUp);
  if (sunLocal.z > 0.02 && footprint < 2.5 && light > 0.0) {
    vec2 toward = sunLocal.xy / max(length(sunLocal.xy), 1e-4);
    float tanElevation = sunLocal.z / max(length(sunLocal.xy), 1e-4);
    float blocked = 0.0;
    for (int i = 0; i < 7; i++) {
      float s = max(0.15, footprint * 1.5) * pow(1.85, float(i));       // kilometres towards the Sun
      vec2 spot = ll + vec2(toward.x * s / (R_KM * cosLat), toward.y * s / R_KM);
      float excess = terrainHeight(spot, lodA + 0.5, lodB + 0.5) - h0 - s * tanElevation - 0.002 * s;
      blocked = max(blocked, smoothstep(0.0, 0.03 * s + 0.002, excess));
    }
    light *= 1.0 - blocked;
  }

  albedo = pow(albedo, vec3(1.12)) * 1.5 * tone;
  vec3 earthshine = vec3(0.010, 0.014, 0.024);
  // A little light scattered from neighbouring ground keeps shadows from being pure black.
  vec3 colour = albedo * (light * 1.7 + 0.034) * uExposure + earthshine;
  colour = 1.0 - exp(-colour * 1.15);                   // soft shoulder, so bright ground never clips flat
  gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)), 1.0); // the colour map is stored as it is, so convert by hand
}
`;

export function createMoonMaterial(THREE: typeof ThreeNamespace, inputs: MoonMaterialInputs, radius: number) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uColor: { value: inputs.color },
      uRelief: { value: inputs.relief },
      uDetailA: { value: inputs.detailA },
      uDetailB: { value: inputs.detailB },
      uSunObj: { value: new THREE.Vector3(1, 0, 0) },
      uCamObj: { value: new THREE.Vector3() },
      uRadius: { value: radius },
      uExposure: { value: 1 },
    },
  });
}
