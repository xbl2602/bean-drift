// Pieces of GPU code (GLSL) shared by the space scene and the lunar-surface scene.
// A shader that includes these must declare: uniform float uTime; uniform float uPixelRatio;
// uniform sampler2D uEarthColor;

export const GLSL_NOISE = `
const float PI = 3.14159265;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float amplitude = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 4; i++) {
    sum += amplitude * noise3(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return sum;
}
`;

export const GLSL_STARS = `
// Twinkling star field. cssPixel is the position in CSS pixels; driftPx slides the stars sideways.
vec3 starField(vec2 cssPixel, float driftPx) {
  vec3 color = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float cell = layer == 0 ? 42.0 : 118.0;
    float parallax = layer == 0 ? 0.6 : 1.0;
    vec2 p = (cssPixel + vec2(driftPx * parallax, 0.0)) / cell;
    vec2 id = floor(p) + float(layer) * 31.0;
    float seed = hash21(id);
    if (seed < 0.5) continue;
    vec2 starPos = vec2(hash21(id + 3.1), hash21(id + 7.7)) * 0.8 + 0.1;
    float dist = length((fract(p) - starPos) * cell);
    float size = (layer == 0 ? 0.55 : 1.05) * (0.6 + 0.8 * hash21(id + 11.0));
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + 2.5 * hash21(id + 5.0)) + seed * 40.0);
    float brightness = exp(-dist * dist / (size * size)) * twinkle * (0.35 + 0.65 * seed);
    vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.9, 0.78), hash21(id + 19.0));
    color += tint * brightness;
  }
  return color;
}
`;

export const GLSL_GLOBE = `
vec2 sphereUv(vec3 n) {
  return vec2(atan(n.x, n.z) / (2.0 * PI) + 0.5, asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5);
}

// Picks the texture sharpness level from how many texels land on one screen pixel.
float textureLevel(sampler2D tex, float radius, float facing) {
  float texelsPerPixel = float(textureSize(tex, 0).x) / (2.0 * PI * radius * max(facing, 0.12));
  return max(log2(texelsPerPixel), 0.0);
}

// The unit normal of a sphere drawn as a flat disc, for the pixel at "offset" from its centre.
vec3 discNormal(vec2 offset, float radius) {
  vec2 q = offset / radius;
  return vec3(q, sqrt(max(1.0 - dot(q, q), 0.0)));
}
`;

export const GLSL_EARTH = `
vec3 shadeEarth(vec3 viewNormal, mat3 rotation, vec3 viewLight, float radius) {
  vec3 n = rotation * viewNormal;
  vec3 light = rotation * viewLight;
  vec2 uv = sphereUv(n);
  vec3 surface = textureLod(uEarthColor, uv, textureLevel(uEarthColor, radius, viewNormal.z)).rgb;
  surface = pow(surface, vec3(0.9)) * 1.15;

  // Drifting procedural clouds (illustrative, not weather data).
  float drift = uTime * 0.006;
  vec3 cloudPoint = vec3(n.x * cos(drift) - n.z * sin(drift), n.y * 1.6, n.x * sin(drift) + n.z * cos(drift));
  float clouds = smoothstep(0.5, 0.78, fbm(cloudPoint * 3.2 + fbm(cloudPoint * 6.0) * 0.6));

  float daylight = smoothstep(-0.12, 0.3, dot(n, light));
  float ocean = smoothstep(0.02, 0.12, surface.b - max(surface.r, surface.g));
  vec3 reflected = reflect(-viewLight, viewNormal);
  float glint = pow(max(reflected.z, 0.0), 48.0) * ocean * (1.0 - clouds) * 0.7;

  vec3 color = mix(surface, vec3(1.0), clouds * 0.9) * daylight * 1.25;
  color += vec3(1.0, 0.95, 0.85) * glint * daylight;
  float rim = pow(1.0 - viewNormal.z, 2.6);
  color += vec3(0.28, 0.55, 1.0) * rim * (0.15 + daylight) * 0.9;
  color += vec3(0.004, 0.008, 0.02);
  return color;
}

// Paints the Earth (with its thin atmosphere halo) over "color" for the pixel at "frag".
vec3 drawEarth(vec3 color, vec2 frag, vec2 center, float radius, mat3 rotation, vec3 light) {
  vec2 offset = frag - center;
  float dist = length(offset);
  if (dist >= radius * 1.16) return color;
  float sunSide = smoothstep(-0.5, 0.6, dot(normalize(offset + vec2(1e-5)), normalize(light.xy + vec2(1e-5))));
  float halo = pow(clamp(1.0 - (dist - radius) / (radius * 0.16), 0.0, 1.0), 3.0);
  color += vec3(0.22, 0.5, 1.0) * halo * sunSide * 0.55 * step(radius, dist);
  if (dist < radius) {
    vec3 shaded = shadeEarth(discNormal(offset, radius), rotation, light, radius);
    color = mix(color, shaded, smoothstep(radius, radius - 1.5 * uPixelRatio, dist));
  }
  return color;
}
`;

export const GLSL_SUN = `
vec3 sunGlow(vec2 offset, float radius) {
  float d = length(offset) / radius;
  float angle = atan(offset.y, offset.x);
  float rays = 0.6 + 0.4 * noise3(vec3(angle * 5.0, uTime * 0.12, 1.7)) + 0.25 * noise3(vec3(angle * 17.0, uTime * 0.2, 9.1));
  vec3 glow = vec3(1.0, 0.86, 0.62) * (1.1 / (1.0 + pow(d, 2.1) * 0.55)) * smoothstep(26.0, 2.0, d);
  glow += vec3(1.0, 0.8, 0.5) * rays * exp(-d * 0.42) * 0.3;
  // Thin horizontal streak, as a camera lens would show.
  glow += vec3(1.0, 0.92, 0.8) * exp(-abs(offset.y) / (radius * 0.07)) * exp(-abs(offset.x) / (radius * 4.5)) * 0.45;
  return glow;
}

// Paints the Sun's glow and disc over "color"; "strength" (0..1) dims it, e.g. when partly hidden.
vec3 drawSun(vec3 color, vec2 frag, vec2 center, float radius, float strength) {
  vec2 offset = frag - center;
  float dist = length(offset);
  color += sunGlow(offset, radius) * strength;
  float disc = smoothstep(radius, radius - 1.5 * uPixelRatio, dist);
  float limb = sqrt(max(1.0 - (dist * dist) / (radius * radius), 0.0));
  return mix(color, vec3(3.6, 3.3, 2.7) * (0.75 + 0.4 * limb), disc);
}

// Soft roll-off for very bright values, plus a tiny dither so dark gradients do not band.
vec3 finishColor(vec3 color, vec2 frag) {
  color = 1.0 - exp(-color * 1.15);
  return color + (hash21(frag + uTime) - 0.5) / 255.0;
}
`;
