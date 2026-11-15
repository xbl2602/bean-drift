// The Moon for the console backdrop: a sphere shaded by a custom shader.
//
// Far away it is the NASA colour map with relief from the LOLA elevation map. Close to the camera,
// where those maps run out of detail (one map texel is about 2.7 km), the shader adds craters and
// rocks of every size on top. Each layer of detail is switched off as soon as its features would be
// smaller than a few screen pixels, so the ground stays crisp where it is near and the cost stays low
// where it is far (the layers are skipped, not just faded).
//
// Light comes from one fixed direction, expressed in the Moon's own frame by the page each frame.

import type * as ThreeNamespace from "three";

export type MoonMaterialInputs = {
  color: ThreeNamespace.Texture;
  relief: ThreeNamespace.Texture;
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
uniform vec3 uSunObj;    // direction towards the Sun, in the Moon's frame
uniform vec3 uCamObj;    // camera position, in the Moon's frame (scene units)
uniform float uRadius;   // scene radius of the Moon

const float PI = 3.14159265;
const float R_KM = 1737.4;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 17.31));
}

// One layer of craters on a grid of 'cell' kilometres. Returns the slope (dimensionless, in the east
// and north directions) in .xy and a brightness change in .z. A crater is a bowl with a sharp raised rim.
vec3 craterLayer(vec2 chart, float cell, float seed) {
  vec2 scaled = chart / cell;
  vec2 id = floor(scaled);
  vec2 f = scaled - id;
  vec2 slope = vec2(0.0);
  float tone = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cid = id + g + seed;
      if (hash21(cid) < 0.4) continue;              // not every cell holds a crater
      vec2 centre = g + 0.2 + 0.6 * hash22(cid * 1.7 + 3.1);
      float radius = 0.16 + 0.3 * hash21(cid + 9.0);
      vec2 d = f - centre;
      float dist = length(d) + 1e-4;
      float t = dist / radius;
      if (t > 2.4) continue;
      float fresh = hash21(cid + 5.0);              // young craters are deep and crisp
      float depth = 0.34 * mix(0.35, 1.0, fresh);
      float rim = 0.3 * depth;
      float dh = t < 1.0 ? 2.0 * depth * t : -3.0 * rim * exp(-3.0 * (t - 1.0));
      slope += dh * (d / dist);
      tone += fresh * exp(-9.0 * (t - 1.0) * (t - 1.0)) * 0.28 - (t < 1.0 ? 0.05 * fresh : 0.0);
    }
  }
  return vec3(slope, tone);
}

// Small rocks: a bump in a fraction of the cells of a fine grid.
vec3 rockLayer(vec2 chart, float cell) {
  vec2 scaled = chart / cell;
  vec2 id = floor(scaled);
  vec2 f = scaled - id;
  vec2 slope = vec2(0.0);
  float tone = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cid = id + g + 71.0;
      if (hash21(cid) < 0.72) continue;
      vec2 centre = g + 0.15 + 0.7 * hash22(cid * 2.3);
      float radius = 0.1 + 0.16 * hash21(cid + 4.0);
      vec2 d = f - centre;
      float dist = length(d) + 1e-4;
      float t = dist / radius;
      if (t > 1.0) continue;
      slope += (-1.6 * t) * (d / dist) * 0.9;     // a rounded boulder: steep sides
      tone += 0.08 * (1.0 - t);
    }
  }
  return vec3(slope, tone);
}

void main() {
  vec3 n0 = normalize(vObj);
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), n0) + vec3(1e-6, 0.0, 0.0));
  vec3 north = cross(n0, east);
  float lon = atan(n0.x, n0.z);
  float lat = asin(clamp(n0.y, -1.0, 1.0));
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);

  vec3 albedo = texture2D(uColor, uv).rgb;

  // Relief from the elevation map: tilt the normal by the slope measured across neighbouring texels.
  vec2 texel = vec2(1.0 / 4096.0, 1.0 / 2048.0);
  float metresPerStep = 255.0 * 1800.0 / 127.0;
  float dhEast = (texture2D(uRelief, uv + vec2(texel.x, 0.0)).r - texture2D(uRelief, uv - vec2(texel.x, 0.0)).r) * metresPerStep;
  float dhNorth = (texture2D(uRelief, uv + vec2(0.0, texel.y)).r - texture2D(uRelief, uv - vec2(0.0, texel.y)).r) * metresPerStep;
  float cosLat = max(cos(lat), 0.08);
  float slopeEast = dhEast / (2.0 * texel.x * 2.0 * PI * 1737400.0 * cosLat);
  float slopeNorth = dhNorth / (2.0 * texel.y * PI * 1737400.0);
  vec2 slope = 3.0 * vec2(slopeEast, slopeNorth);
  float tone = 0.0;

  // Close-up detail, on a flat map of the ground in kilometres.
  vec2 chart = vec2(lon * R_KM * cosLat, lat * R_KM);
  float footprint = max(length(fwidth(chart)), 1e-5);
  float seam = 0.0;
  // Each layer is used only while its cells span enough pixels; otherwise it would shimmer.
  float cells[3];
  cells[0] = 7.0;
  cells[1] = 1.9;
  cells[2] = 0.52;
  for (int k = 0; k < 3; k++) {
    float pixelsPerCell = cells[k] / footprint;
    float weight = smoothstep(6.0, 22.0, pixelsPerCell);
    if (weight < 0.01) continue;
    vec3 layer = craterLayer(chart, cells[k], float(k) * 31.0);
    slope += layer.xy * weight * (0.55 + 0.25 * float(k));
    tone += layer.z * weight;
  }
  float rockCell = 0.11;
  float rockWeight = smoothstep(5.0, 16.0, rockCell / footprint);
  if (rockWeight > 0.01) {
    vec3 rocks = rockLayer(chart, rockCell);
    slope += rocks.xy * rockWeight * 0.5;
    tone += rocks.z * rockWeight;
  }
  // Fine grain on the dust so flat ground is not smooth plastic.
  float grain = hash21(floor(chart / max(footprint * 1.5, 0.004))) - 0.5;
  tone += grain * 0.06 * smoothstep(3.0, 14.0, 0.05 / footprint);

  vec3 normal = normalize(n0 - slope.x * east - slope.y * north);
  vec3 sun = normalize(uSunObj);
  vec3 view = normalize(uCamObj - vObj);
  float nl = max(dot(normal, sun), 0.0);
  float nv = max(dot(normal, view), 0.03);
  // Lunar dust stays bright even when the light is grazing.
  float lommel = 2.0 * nl / (nl + nv);
  float daylight = smoothstep(-0.04, 0.08, dot(n0, sun));
  float light = mix(nl, lommel, 0.5) * daylight;

  albedo = pow(albedo, vec3(1.15)) * 1.4 * (1.0 + tone);
  vec3 earthshine = vec3(0.012, 0.016, 0.026);
  vec3 colour = albedo * (light * 1.55 + 0.018) + earthshine;
  colour = 1.0 - exp(-colour * 1.15);                 // soft shoulder, so bright ground never clips flat
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
      uSunObj: { value: new THREE.Vector3(1, 0, 0) },
      uCamObj: { value: new THREE.Vector3() },
      uRadius: { value: radius },
    },
  });
}
