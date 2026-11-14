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

const GLSL_SUN_PROCEDURAL = `
// Cell pattern for the Sun's boiling surface ("granulation"): distance to the nearest cell centre.
// Cells slowly drift, as the real granules appear and fade over minutes.
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float granuleDistance(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  float nearest = 1.5;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 shift = vec3(float(x), float(y), float(z));
        vec3 center = hash33(cell + shift);
        center = 0.5 + 0.5 * sin(uTime * 0.28 + 6.2831 * center);
        nearest = min(nearest, length(shift + center - local));
      }
    }
  }
  return nearest;
}

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

// The Sun's surface as a photograph shows it: boiling granules, dark sunspots, bright plages near
// the edge, and an edge that is dimmer and redder than the middle ("limb darkening").
// "n" is the unit normal of the visible hemisphere (z towards the viewer).
vec3 sunSurface(vec3 n, float radius) {
  float mu = n.z;
  // The Sun turns once in about a month; here it turns visibly but gently.
  float spin = uTime * 0.012;
  vec3 p = vec3(n.x * cos(spin) + n.z * sin(spin), n.y, -n.x * sin(spin) + n.z * cos(spin));

  // Only draw detail the screen can actually show, so small suns stay clean.
  float detail = smoothstep(16.0, 85.0, radius / uPixelRatio);
  float granules = 0.5;
  if (detail > 0.0) {
    float coarseCells = granuleDistance(p * 26.0 + 3.0);
    float fineCells = granuleDistance(p * 70.0 + 11.0);
    granules = mix(0.5, 1.0 - smoothstep(0.18, 0.78, mix(coarseCells, fineCells, 0.45)), detail);
  }
  float lanes = mix(0.76, 1.12, granules);

  // Sunspots appear in two bands either side of the equator: a dark core inside a lighter fringe.
  float band = smoothstep(0.05, 0.25, abs(p.y)) * smoothstep(0.7, 0.4, abs(p.y));
  float spotField = noise3(p * 2.6 + vec3(4.0, 1.0, 7.0)) + 0.35 * noise3(p * 9.0);
  float penumbra = smoothstep(0.8, 0.95, spotField) * band * detail;
  float umbra = smoothstep(0.96, 1.08, spotField) * band * detail;
  float spots = 1.0 - 0.4 * penumbra - 0.5 * umbra;

  // Bright, veined "plage" regions, strongest towards the edge.
  float plage = smoothstep(0.58, 0.86, noise3(p * 5.0 + vec3(9.0))) * (1.0 - mu) * 0.55;

  // Limb darkening: the edge shows cooler, higher layers, so it is dimmer and more orange.
  float limbDim = 1.0 - 0.68 * (1.0 - mu) - 0.12 * pow(1.0 - mu, 3.0);
  vec3 hot = vec3(2.25, 1.62, 0.88);
  vec3 cool = vec3(1.9, 0.92, 0.36);
  vec3 tone = mix(cool, hot, pow(mu, 0.55));
  return tone * limbDim * lanes * spots * (1.0 + plage);
}

// Paints the Sun's glow and disc over "color"; "strength" (0..1) dims it, e.g. when partly hidden.
vec3 drawSun(vec3 color, vec2 frag, vec2 center, float radius, float strength) {
  vec2 offset = frag - center;
  float dist = length(offset);
  float d = dist / radius;
  color += sunGlow(offset, radius) * strength * 0.7;

  // Arcs of glowing gas ("prominences") and the thin red chromosphere hugging the edge.
  // Prominences only show once the Sun is big enough on screen; as a small disc it stays a clean glow.
  float prominenceShare = smoothstep(20.0, 70.0, radius / uPixelRatio);
  if (d > 0.98 && d < 1.7 && prominenceShare > 0.0) {
    float angle = atan(offset.y, offset.x);
    float lift = noise3(vec3(angle * 2.4, 1.3, uTime * 0.03));
    float arcs = smoothstep(0.58, 0.82, lift);
    float height = 0.03 + 0.16 * arcs;
    float fibres = 0.65 + 0.35 * noise3(vec3(angle * 60.0, d * 24.0, uTime * 0.07));
    float outside = step(0.995, d);
    float shape = exp(-pow(max(d - 1.0, 0.0) / height, 1.4)) * outside;
    color += vec3(1.0, 0.3, 0.16) * shape * (0.25 + 1.5 * arcs) * fibres * strength * 1.4 * prominenceShare;
    color += vec3(1.0, 0.25, 0.14) * exp(-max(d - 1.0, 0.0) * 90.0) * outside * 0.8 * strength * prominenceShare;
  }

  if (dist < radius * 1.01) {
    float disc = smoothstep(radius, radius - 1.5 * uPixelRatio, dist);
    color = mix(color, sunSurface(discNormal(offset, radius), radius), disc);
  }
  return color;
}

`;

export const GLSL_FINISH = `
// Soft roll-off for very bright values, plus a tiny dither so dark gradients do not band.
vec3 finishColor(vec3 color, vec2 frag) {
  color = 1.0 - exp(-color * 1.15);
  return color + (hash21(frag + uTime) - 0.5) / 255.0;
}
`;

export const GLSL_SUN = GLSL_SUN_PROCEDURAL + GLSL_FINISH;

// The Sun as photographed by NASA's Solar Dynamics Observatory (171 angstrom, 4096 x 4096).
// The disc fills 79% of the picture's width and the corona streams out to its edges.
export const GLSL_SUN_PHOTO = `
const float SUN_DISC_SHARE = 0.396;   // disc radius / image width in the SDO picture
const float SUN_IMAGE_TEXELS = 4096.0;

vec3 sunGlow(vec2 offset, float radius) {
  float d = length(offset) / radius;
  float angle = atan(offset.y, offset.x);
  float rays = 0.6 + 0.4 * noise3(vec3(angle * 5.0, uTime * 0.12, 1.7)) + 0.25 * noise3(vec3(angle * 17.0, uTime * 0.2, 9.1));
  vec3 glow = vec3(1.0, 0.72, 0.36) * (0.8 / (1.0 + pow(d, 2.1) * 0.6)) * smoothstep(22.0, 2.0, d);
  glow += vec3(1.0, 0.68, 0.32) * rays * exp(-d * 0.5) * 0.22;
  return glow;
}

// Paints the Sun from the photograph: granular surface, bright active regions, loops of glowing
// gas, and the corona beyond the edge. "strength" (0..1) dims it.
vec3 drawSun(vec3 color, vec2 frag, vec2 center, float radius, float strength) {
  vec2 offset = frag - center;
  float d = length(offset) / radius;
  color += sunGlow(offset, radius) * strength * 0.7;
  if (d < 0.5 / SUN_DISC_SHARE) {
    // Turn the picture very slowly so the surface looks alive; the Sun does rotate.
    float spin = uTime * 0.006;
    vec2 q = vec2(offset.x * cos(spin) - offset.y * sin(spin), offset.x * sin(spin) + offset.y * cos(spin));
    vec2 uv = vec2(0.5) + q / radius * SUN_DISC_SHARE;
    uv.y = 1.0 - uv.y; // the photograph's first row is the top
    float texelsPerPixel = SUN_DISC_SHARE * SUN_IMAGE_TEXELS / radius;
    vec3 photo = textureLod(uSunImage, uv, max(log2(texelsPerPixel) - 0.5, 0.0)).rgb;
    // The picture is slightly dim and its brightest loops clip; lift both so it glows like a star.
    photo = pow(photo, vec3(0.82)) * 1.75;
    float fade = 1.0 - smoothstep(0.82, 1.0, d * SUN_DISC_SHARE * 2.0);
    color += photo * fade * strength;
  }
  return color;
}
` + GLSL_FINISH;
