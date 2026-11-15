// The console backdrop: a chase-camera view of a relay satellite in low lunar orbit (decoration
// only, no text). The camera is fixed to the satellite, which sits at the lower right; the Moon fills
// the left and bottom; the Earth hangs at the upper right. To keep the numbers simple the satellite
// does not move: the Moon turns beneath it, which is the same picture as flying over the surface.
//
// Light is one fixed direction chosen to show the ground at the satellite's position; dates and times
// are ignored on purpose. Links follow real line of sight (lunar-terrain.ts): a base is linked only
// while the satellite can actually see it over the terrain, never more than two at once, and the
// Earth link is always on.
//
// three.js is loaded on demand, so visitors who never scroll here do not download it.

import type * as ThreeNamespace from "three";
import { createAdaptivePixelRatio } from "./adaptive-pixel-ratio";
import type { CanvasRenderer } from "./gl-utils";
import { LUNAR_BASES } from "./lunar-bases";
import { createLinkTextures, RadioLink } from "./lunar-links";
import { createMoonMaterial } from "./lunar-moon-material";
import { canSee, chooseLinks, directionFromLatLon, MAX_BASE_LINKS, MOON_RADIUS, TerrainHeights, type Vec3 } from "./lunar-terrain";
import { buildSatelliteParts, GROUP_ORIGIN, type PartKind } from "./satellite-model";

type Three = typeof ThreeNamespace;

const ALTITUDE = 5.5; // scene units (about 96 km at this scale)
const SATELLITE_SCALE = 0.5;
const GROUND_SPEED_RAD_PER_S = 0.012; // how fast the Moon turns under the satellite (sped up for the picture)
const SUN_DIRECTION: Vec3 = [-0.28, -0.88, 0.38]; // low over the horizon, so the ground throws long shadows
const CAMERA_OFFSET: Vec3 = [-7.2, 2.4, 4.6];
const CAMERA_ROLL_DEG = -24;
const SATELLITE_SCREEN = { x: 0.74, y: 0.68 };
const EARTH_SCREEN = { x: 0.86, y: 0.22 };
const EARTH_DISTANCE = 420;
const EARTH_ANGULAR_RADIUS = 0.07;
// Drawn at 1.5x to 2x the screen size and scaled down: smooth edges on thin links even on ordinary
// screens. On a GPU that cannot keep up this steps down to screen resolution (adaptive-pixel-ratio.ts).
const MIN_PIXEL_RATIO = 1.5;
const MAX_PIXEL_RATIO = 2;
const LINK_FADE_PER_S = 5;
/**
 * The part of the picture (fractions of the canvas, y from the top) where radio links are allowed: the area around
 * the satellite and the ground to its right, below the Earth. A base is only linked while it is inside, so a link
 * never runs off the edge of the screen, whatever its size. A base that is already linked may drift LINK_REGION_HOLD
 * past the edge before its link closes, so a base sitting right on the edge does not flicker.
 */
const LINK_REGION = { left: 0.55, right: 0.96, top: 0.25, bottom: 0.97 };
const LINK_REGION_HOLD = 0.03;

const TEXTURES = {
  moonColor: "/landing/moon-color-4k.jpg",
  moonRelief: "/landing/moon-relief-4k.jpg",
  earth: "/landing/earth-blue-marble-2k.jpg",
  detailA: "/landing/lunar-detail-a.png",
  detailB: "/landing/lunar-detail-b.png",
  height: "/landing/moon-height-2k.png",
  foilColor: "/landing/satellite/foil-color.png",
  foilNormal: "/landing/satellite/foil-normal.png",
  panelColor: "/landing/satellite/panel-color.png",
  panelNormal: "/landing/satellite/panel-normal.png",
  dishColor: "/landing/satellite/dish-color.png",
  dishNormal: "/landing/satellite/dish-normal.png",
  ao: "/landing/satellite/ao.json",
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type BaseState = { id: string; direction: Vec3; marker: ThreeNamespace.Sprite; strength: number; link: RadioLink; quiet: boolean };

async function buildScene(canvas: HTMLCanvasElement) {
  const [THREE, roundedBox] = await Promise.all([import("three"), import("three/examples/jsm/geometries/RoundedBoxGeometry.js")]);
  const { RoundedBoxGeometry } = roundedBox;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const loader = new THREE.TextureLoader();
  const load = (url: string, srgb: boolean, repeat = false) =>
    loader.loadAsync(url).then((texture) => {
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = maxAnisotropy;
      if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      return texture;
    });
  const terrain = new TerrainHeights();
  const [moonColor, moonRelief, detailA, detailB, earthMap, foilColor, foilNormal, panelColor, panelNormal, dishColor, dishNormal, aoData] = await Promise.all([
    load(TEXTURES.moonColor, false),
    load(TEXTURES.moonRelief, false),
    load(TEXTURES.detailA, false, true),
    load(TEXTURES.detailB, false, true),
    load(TEXTURES.earth, true),
    load(TEXTURES.foilColor, true, true),
    load(TEXTURES.foilNormal, false, true),
    load(TEXTURES.panelColor, true, true),
    load(TEXTURES.panelNormal, false, true),
    load(TEXTURES.dishColor, true, true),
    load(TEXTURES.dishNormal, false, true),
    fetch(TEXTURES.ao).then((response) => response.json() as Promise<Record<string, string>>),
    terrain.load(TEXTURES.height),
  ]);
  moonColor.wrapS = moonRelief.wrapS = THREE.RepeatWrapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 2, 0.05, 3000);

  // ---- stars ----
  {
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 7;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < count; i++) {
      const z = random() * 2 - 1;
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      positions.set([Math.cos(a) * r * 1400, Math.sin(a) * r * 1400, z * 1400], i * 3);
      const brightness = 0.35 + 0.65 * Math.pow(random(), 3);
      const warm = random();
      colors.set([brightness * (0.8 + 0.2 * warm), brightness * 0.9, brightness * (1 - 0.2 * warm)], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
    stars.renderOrder = -10;
    stars.frustumCulled = false;
    scene.add(stars);
    scene.userData.stars = stars;
  }

  // ---- Moon ----
  const moonGroup = new THREE.Group();
  const moonMaterial = createMoonMaterial(THREE, { color: moonColor, relief: moonRelief, detailA, detailB }, MOON_RADIUS);
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, 192, 128), moonMaterial);
  moonGroup.add(moonMesh);
  scene.add(moonGroup);

  const linkTextures = createLinkTextures(THREE);
  const baseLinkStyle = { color: 0x7fe6ff, pulses: 4, speed: 5.5, headSize: 0.34 };
  const bases: BaseState[] = LUNAR_BASES.map((base) => {
    const direction = directionFromLatLon(base.latDeg, base.lonDeg);
    const radius = terrain.radius(direction) + 0.05;
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: linkTextures.glow, color: 0x9fe8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    marker.position.set(direction[0] * radius, direction[1] * radius, direction[2] * radius);
    marker.scale.setScalar(0.5);
    moonGroup.add(marker);
    const link = new RadioLink(THREE, linkTextures, baseLinkStyle);
    link.group.visible = false;
    scene.add(link.group);
    return { id: base.id, direction, marker, strength: 0, link, quiet: base.quiet === true };
  });

  // ---- Earth, fixed in the camera's frame so it is always at the upper right ----
  const earthGroup = new THREE.Group();
  const earthRadius = EARTH_DISTANCE * Math.tan(EARTH_ANGULAR_RADIUS);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius, 96, 64),
    new THREE.MeshStandardMaterial({ map: earthMap, roughness: 0.85, metalness: 0, emissive: 0xffffff, emissiveMap: earthMap, emissiveIntensity: 0.32 }),
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.045, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: "varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = (modelViewMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec3 vN; varying vec3 vP; void main(){ float rim = pow(clamp(1.0 + dot(normalize(vN), normalize(vP)), 0.0, 1.0), 4.0); gl_FragColor = vec4(vec3(0.3,0.6,1.0) * rim * 0.75, rim * 0.6); }",
    }),
  );
  earthGroup.add(earth, atmosphere);
  scene.add(earthGroup);

  // ---- lights ----
  const sunDirection = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const sun = new THREE.DirectionalLight(0xfff3df, 3.4);
  sun.position.copy(sunDirection).multiplyScalar(500);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x25365e, 0x6f6d68, 0.9)); // dim sky, bright moonlit ground bounce

  // ---- the satellite ----
  const satelliteRoot = new THREE.Group();
  const groups = {
    body: new THREE.Group(),
    wingPlus: new THREE.Group(),
    wingMinus: new THREE.Group(),
    dish: new THREE.Group(),
  };
  groups.dish.position.set(...GROUP_ORIGIN.dish);
  satelliteRoot.add(groups.body, groups.wingPlus, groups.wingMinus, groups.dish);
  const materials: Record<PartKind, ThreeNamespace.Material> = {
    foil: new THREE.MeshStandardMaterial({ map: foilColor, normalMap: foilNormal, normalScale: new THREE.Vector2(1.1, 1.1), metalness: 0.92, roughness: 0.4, vertexColors: true }),
    panel: new THREE.MeshStandardMaterial({ map: panelColor, normalMap: panelNormal, normalScale: new THREE.Vector2(0.9, 0.9), metalness: 0.55, roughness: 0.28, vertexColors: true }),
    dish: new THREE.MeshStandardMaterial({ map: dishColor, normalMap: dishNormal, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8b95a3, metalness: 0.85, roughness: 0.42, vertexColors: true }),
    radiator: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.1, roughness: 0.6, vertexColors: true }),
  };
  const parts = buildSatelliteParts({ THREE, RoundedBoxGeometry });
  for (const part of parts) {
    // Bake in the ambient occlusion computed offline (see bake-satellite.mjs).
    const encoded = aoData[part.name];
    const count = part.geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    if (encoded) {
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      for (let i = 0; i < count; i++) {
        const value = 0.3 + 0.7 * (bytes[i] / 255);
        colors.set([value, value, value], i * 3);
      }
    } else {
      colors.fill(1);
    }
    part.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(part.geometry, materials[part.kind]);
    mesh.position.set(...part.position);
    mesh.rotation.set(...part.rotation);
    groups[part.group].add(mesh);
  }
  satelliteRoot.scale.setScalar(SATELLITE_SCALE);
  satelliteRoot.position.set(0, 0, MOON_RADIUS + ALTITUDE);
  satelliteRoot.rotation.set(0, 0, 0.35); // a little yaw so the satellite is seen at an angle
  scene.add(satelliteRoot);

  // Wings face the Sun about their own axis; the dish tracks the Earth.
  groups.wingPlus.rotation.y = groups.wingMinus.rotation.y = Math.atan2(sunDirection.x, sunDirection.z);

  const earthLink = new RadioLink(THREE, linkTextures, { color: 0xffe08a, pulses: 5, speed: 22, headSize: 0.7 });
  scene.add(earthLink.group);

  // ---- camera composition ----
  const satellitePosition = satelliteRoot.position.clone();
  camera.position.set(satellitePosition.x + CAMERA_OFFSET[0], satellitePosition.y + CAMERA_OFFSET[1], satellitePosition.z + CAMERA_OFFSET[2]);
  const forward = satellitePosition.clone().sub(camera.position).normalize();
  camera.up.set(0, 0, 1).applyAxisAngle(forward, (CAMERA_ROLL_DEG * Math.PI) / 180);
  camera.lookAt(satellitePosition);

  const size = { width: 1, height: 1 };
  // Follows screen density and zoom; draws fewer pixels if this GPU cannot keep up.
  const resolution = createAdaptivePixelRatio({ minRatio: MIN_PIXEL_RATIO, maxRatio: MAX_PIXEL_RATIO }, () => resize(size.width, size.height));
  const placeEarth = () => {
    camera.updateMatrixWorld();
    const ndc = new THREE.Vector3(EARTH_SCREEN.x * 2 - 1, 1 - EARTH_SCREEN.y * 2, 0.5).unproject(camera);
    const direction = ndc.sub(camera.position).normalize();
    earthGroup.position.copy(camera.position).addScaledVector(direction, EARTH_DISTANCE);
  };
  const resize = (width: number, height: number) => {
    size.width = Math.max(1, width);
    size.height = Math.max(1, height);
    renderer.setPixelRatio(resolution.current());
    renderer.setSize(size.width, size.height, false);
    camera.aspect = size.width / size.height;
    // Shift the picture so the satellite sits at the lower right instead of the centre.
    camera.setViewOffset(size.width, size.height, -(SATELLITE_SCREEN.x - 0.5) * size.width, -(SATELLITE_SCREEN.y - 0.5) * size.height, size.width, size.height);
    camera.updateProjectionMatrix();
    placeEarth();
  };

  // ---- per-frame state ----
  let linked: string[] = [];
  let lastTimeS = 0;
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const inverse = new THREE.Quaternion();
  const feedLocal = new THREE.Vector3(0, 0.36, 0);
  const dishAim = new THREE.Vector3();

  const update = (timeS: number) => {
    const stepS = Math.min(Math.max(timeS - lastTimeS, 0), 0.1);
    lastTimeS = timeS;

    // The Moon turns beneath the satellite (eastward ground track), and the light is fixed in space.
    moonGroup.rotation.y = -timeS * GROUND_SPEED_RAD_PER_S * 1;
    inverse.copy(moonGroup.quaternion).invert();
    const satelliteMoonFrame = tmpA.copy(satellitePosition).applyQuaternion(inverse);
    const satelliteInMoon: Vec3 = [satelliteMoonFrame.x, satelliteMoonFrame.y, satelliteMoonFrame.z];
    const sunInMoon = tmpB.copy(sunDirection).applyQuaternion(inverse);
    moonMaterial.uniforms.uSunObj.value.copy(sunInMoon);
    moonMaterial.uniforms.uCamObj.value.copy(camera.position).applyQuaternion(inverse);

    // Which bases can the satellite see right now?
    const visible: { id: string; distance: number }[] = [];
    for (const base of bases) {
      const view = canSee(terrain, base.direction, satelliteInMoon);
      if (!view.visible) continue;
      // Where is the base on the screen? Only bases inside the allowed part of the picture can be linked.
      const world = moonGroup.localToWorld(base.marker.position.clone()).project(camera);
      const hold = linked.includes(base.id) ? LINK_REGION_HOLD : 0;
      const x = (world.x + 1) / 2;
      const y = (1 - world.y) / 2;
      const inside = world.z < 1 && x >= LINK_REGION.left - hold && x <= LINK_REGION.right + hold && y >= LINK_REGION.top - hold && y <= LINK_REGION.bottom + hold;
      if (inside) visible.push({ id: base.id, distance: view.distance });
    }
    visible.sort((a, b) => a.distance - b.distance);
    const currentCount = bases.filter((base) => base.strength > 0.05).length;
    const wanted = chooseLinks(linked, visible.map((entry) => entry.id));
    // Never show more than two links at once: a new link waits until a dropped one has faded out.
    const fadingOut = bases.filter((base) => !wanted.includes(base.id) && base.strength > 0.05).length;
    linked = wanted.filter((id, index) => index < MAX_BASE_LINKS - fadingOut || bases.find((b) => b.id === id)!.strength > 0.05);
    void currentCount;

    const feed = groups.dish.localToWorld(feedLocal.clone());
    const earthCentre = earthGroup.position;
    for (const base of bases) {
      const isLinked = linked.includes(base.id);
      const target = isLinked ? 1 : 0;
      const rate = target > base.strength ? LINK_FADE_PER_S * 0.6 : LINK_FADE_PER_S * 1.6;
      base.strength += (target - base.strength) * Math.min(1, stepS * rate);
      if (Math.abs(target - base.strength) < 0.004) base.strength = target;
      const world = moonGroup.localToWorld(base.marker.position.clone());
      (base.marker.material as ThreeNamespace.SpriteMaterial).opacity = base.quiet ? 0.9 * base.strength : 0.4 + 0.5 * base.strength;
      base.marker.scale.setScalar(0.5 + 0.5 * base.strength);
      base.link.update(feed, world, base.strength, timeS, base.direction[0] * 3.7);
      base.link.ripple(0, world, base.strength, timeS, 2.4, base.direction[2]);
    }

    // The satellite's dish points at the Earth; the Earth link is always on.
    dishAim.copy(earthCentre);
    satelliteRoot.worldToLocal(dishAim).sub(new THREE.Vector3(...GROUP_ORIGIN.dish)).normalize();
    groups.dish.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dishAim);
    const earthEdge = tmpB.copy(earthCentre).sub(feed).normalize().multiplyScalar(earthRadius * 0.92);
    const earthTarget = earthCentre.clone().sub(earthEdge);
    earthLink.update(feed, earthTarget, 1, timeS, 0);
    earthLink.ripple(0, feed, 0.9, timeS, 2.8, 0.25);
    earthLink.ripple(1, earthTarget, 0.5, timeS, earthRadius * 0.4, 0.6);

    // Gentle drift of the satellite's attitude.
    satelliteRoot.rotation.x = 0.03 * Math.sin(timeS * 0.5);
    satelliteRoot.rotation.y = 0.04 * Math.sin(timeS * 0.37);
    earth.rotation.y = timeS * 0.05;

    // Stars stay at infinity.
    (scene.userData.stars as ThreeNamespace.Points).position.copy(camera.position);

    // If this device cannot keep up, quietly draw fewer pixels.
    resolution.noteFrame(performance.now());
  };

  const dispose = () => {
    scene.traverse((object) => {
      const mesh = object as ThreeNamespace.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as ThreeNamespace.Material | ThreeNamespace.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    [moonColor, moonRelief, detailA, detailB, earthMap, foilColor, foilNormal, panelColor, panelNormal, dishColor, dishNormal, linkTextures.glow, linkTextures.ring].forEach((texture) => texture.dispose());
    bases.forEach((base) => base.link.dispose());
    earthLink.dispose();
    resolution.dispose();
    renderer.dispose();
  };

  return { resize, update, render: () => renderer.render(scene, camera), dispose };
}

/** Plugs the scene into useAnimatedCanvas: the three.js code and all pictures load in the background. */
export function createLunarOrbitRenderer(canvas: HTMLCanvasElement): CanvasRenderer<number> | null {
  let width = 1;
  let height = 1;
  let built: Awaited<ReturnType<typeof buildScene>> | null = null;
  let isDisposed = false;
  const ready = buildScene(canvas).then((scene) => {
    if (isDisposed) {
      scene.dispose();
      return;
    }
    built = scene;
    scene.resize(width, height);
  });

  /** The tools grid's viewport position as of the last scroll; reading it forces a layout, so cache it. */
  let gridTopScrollY = -1;
  let gridTop = 0;
  let lastOpacity = -1;

  return {
    ready,
    resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      built?.resize(width, height);
      return { widthPx: width, heightPx: height };
    },
    render(timeS) {
      // The whole backdrop fades once the cards below take over the screen, so text never fights it.
      // Re-measured only on scroll: a per-frame getBoundingClientRect stalled the main thread.
      const wrapper = canvas.parentElement;
      const grid = canvas.closest("section")?.querySelector(".lq-tools-grid");
      if (wrapper && grid) {
        const scrollY = window.scrollY;
        if (scrollY !== gridTopScrollY) {
          gridTop = grid.getBoundingClientRect().top;
          gridTopScrollY = scrollY;
        }
        const opacity = 0.82 + 0.18 * smooth(window.innerHeight * 0.1, window.innerHeight * 0.75, gridTop);
        if (Math.abs(opacity - lastOpacity) > 0.004) {
          lastOpacity = opacity;
          wrapper.style.opacity = opacity.toFixed(3);
        }
      }
      if (!built) return;
      built.update(timeS);
      built.render();
    },
    dispose() {
      isDisposed = true;
      built?.dispose();
      built = null;
    },
  };
}

/**
 * Starts downloading three.js and the pictures in the background, so by the time the section scrolls
 * into view they are already in the browser cache and the scene appears at once instead of popping in.
 */
export function prefetchLunarOrbitAssets(): void {
  void import("three");
  void import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
  for (const [key, url] of Object.entries(TEXTURES)) {
    if (key === "ao") void fetch(url);
    else {
      // The scene is decoration: these downloads must never outrank what the visitor is looking at.
      const image = new Image();
      (image as HTMLImageElement & { fetchPriority?: "low" | "high" | "auto" }).fetchPriority = "low";
      image.src = url;
    }
  }
}
