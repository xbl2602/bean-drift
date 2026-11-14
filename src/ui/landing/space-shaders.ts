// GPU program (GLSL) for the scroll story's space scene. One full-screen pass draws the star field
// and up to three bodies (Moon, Earth, Sun) as lit spheres wrapped in real NASA image maps.
// The Moon and Earth textures are data; the stars, clouds, glow and lighting model are artistic.

import { GLSL_EARTH, GLSL_GLOBE, GLSL_NOISE, GLSL_STARS, GLSL_SUN } from "./shader-chunks";

export const SPACE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

const int MAX_BODIES = 3;
const int KIND_MOON = 0;
const int KIND_EARTH = 1;
const int KIND_SUN = 2;

uniform float uPixelRatio;     // device pixels per CSS pixel
uniform float uTime;           // seconds
uniform float uStarDrift;      // sideways star shift in CSS pixels
uniform int uCount;            // bodies to draw, listed back to front
uniform int uKind[MAX_BODIES];
uniform vec2 uCenter[MAX_BODIES];   // device pixels, origin bottom-left
uniform float uRadius[MAX_BODIES];  // device pixels
uniform mat3 uRotation[MAX_BODIES]; // view space -> the body's own space
uniform vec3 uLight[MAX_BODIES];    // direction towards the Sun, in view space
uniform sampler2D uMoonColor;
uniform sampler2D uMoonHeight;
uniform sampler2D uEarthColor;

out vec4 outColor;
${GLSL_NOISE}
${GLSL_STARS}
${GLSL_GLOBE}
${GLSL_EARTH}
${GLSL_SUN}

vec3 shadeMoon(vec3 viewNormal, mat3 rotation, vec3 viewLight, float radius) {
  vec3 n = rotation * viewNormal;
  vec3 light = rotation * viewLight;
  vec2 uv = sphereUv(n);
  vec3 albedo = textureLod(uMoonColor, uv, textureLevel(uMoonColor, radius, viewNormal.z)).rgb;

  // Relief: tilt the surface normal by the slope of NASA's elevation map so craters catch light and shadow.
  vec3 east = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(n, east);
  vec2 texel = 1.0 / vec2(textureSize(uMoonHeight, 0));
  float level = textureLevel(uMoonHeight, radius, viewNormal.z);
  float slopeEast = textureLod(uMoonHeight, uv + vec2(texel.x, 0.0), level).r - textureLod(uMoonHeight, uv - vec2(texel.x, 0.0), level).r;
  float slopeNorth = textureLod(uMoonHeight, uv + vec2(0.0, texel.y), level).r - textureLod(uMoonHeight, uv - vec2(0.0, texel.y), level).r;
  float cosLatitude = max(sqrt(1.0 - n.y * n.y), 0.08);
  vec3 bumped = normalize(n - 9.0 * (slopeEast / cosLatitude * east + slopeNorth * north));

  float daylight = smoothstep(-0.04, 0.06, dot(n, light));
  float diffuse = pow(max(dot(bumped, light), 0.0), 0.82) * daylight;
  vec3 earthshine = vec3(0.016, 0.02, 0.03);
  // The map is fairly flat and dark; lift its contrast so maria and bright craters read clearly.
  albedo = pow(albedo, vec3(1.25)) * 2.7;
  return albedo * (diffuse * 1.5 + earthshine);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 color = starField(frag / uPixelRatio, uStarDrift);

  for (int i = 0; i < MAX_BODIES; i++) {
    if (i >= uCount) break;
    if (uKind[i] == KIND_SUN) {
      color = drawSun(color, frag, uCenter[i], uRadius[i], 1.0);
    } else if (uKind[i] == KIND_EARTH) {
      color = drawEarth(color, frag, uCenter[i], uRadius[i], uRotation[i], uLight[i]);
    } else {
      vec2 offset = frag - uCenter[i];
      float dist = length(offset);
      float radius = uRadius[i];
      if (dist < radius) {
        vec3 shaded = shadeMoon(discNormal(offset, radius), uRotation[i], uLight[i], radius);
        color = mix(color, shaded, smoothstep(radius, radius - 1.5 * uPixelRatio, dist));
      }
    }
  }

  outColor = vec4(finishColor(color, frag), 1.0);
}
`;
