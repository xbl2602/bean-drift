// NASA Blue Marble texture shaded in world space by the same Sun direction as the Moon.
import * as THREE from "three";

export function createEarthMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSunDirection: { value: new THREE.Vector3(1, 0, 0) }, uDayMap: { value: null } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDayMap;
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPosition;
      void main() {
        vec3 n = normalize(vNormalWorld);
        float mu = dot(n, uSunDirection);
        float daylight = smoothstep(-0.015, 0.015, mu) * pow(max(mu, 0.0), 0.55);
        vec3 surface = texture2D(uDayMap, vUv).rgb;
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.5);
        vec3 atmosphere = vec3(0.12, 0.42, 1.0) * rim * smoothstep(-0.12, 0.25, mu);
        gl_FragColor = vec4(surface * (0.025 + daylight * 1.65) + atmosphere, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
