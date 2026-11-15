// A lunar relay satellite, modelled from simple solids (no outside model file). The shapes are made
// here; the surface detail (crinkled gold foil, solar-cell grid, painted dish ribs) comes from
// normal and colour maps, and the soft shading in crevices comes from ambient occlusion that was
// baked offline into per-vertex values (see bake-satellite.mjs). That is why the same builder is
// used by the page and by the baking script: both must produce identical vertices.
//
// Axes of the model: +Z is "up" (away from the Moon), +X is the direction of flight, +Y is along
// the solar-array axis. The bus faces the Moon with its -Z side. The page turns the arrays to face
// the Sun and the dish to face the Earth.

import type * as ThreeNamespace from "three";
import type { RoundedBoxGeometry as RoundedBoxGeometryClass } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type Three = typeof ThreeNamespace;
export type SatelliteKit = { THREE: Three; RoundedBoxGeometry: typeof RoundedBoxGeometryClass };

export type PartKind = "foil" | "panel" | "dish" | "metal" | "radiator";
export type SatellitePart = {
  name: string;
  kind: PartKind;
  geometry: ThreeNamespace.BufferGeometry;
  /** Where the part sits in its group (the group is what the page turns). */
  position: [number, number, number];
  rotation: [number, number, number];
  group: "body" | "wingPlus" | "wingMinus" | "dish";
};

/** Multiplies the UV coordinates so a texture repeats the right number of times over a part. */
function scaleUv(geometry: ThreeNamespace.BufferGeometry, u: number, v: number) {
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
}

export function buildSatelliteParts(kit: SatelliteKit): SatellitePart[] {
  const { THREE, RoundedBoxGeometry } = kit;
  const parts: SatellitePart[] = [];
  const add = (part: SatellitePart) => parts.push(part);

  // ---- the bus: a foil-wrapped box with a white radiator deck on top ----
  const bus = new RoundedBoxGeometry(1.0, 0.9, 1.1, 5, 0.07);
  scaleUv(bus, 2.2, 2.2);
  add({ name: "bus", kind: "foil", geometry: bus, position: [0, 0, 0], rotation: [0, 0, 0], group: "body" });

  const deck = new THREE.BoxGeometry(0.86, 0.74, 0.03, 10, 8, 1);
  add({ name: "deck", kind: "radiator", geometry: deck, position: [0, 0, 0.565], rotation: [0, 0, 0], group: "body" });

  // Rear bulkhead with the thruster bell and a camera box.
  const bell = new THREE.CylinderGeometry(0.09, 0.2, 0.3, 28, 4, true);
  add({ name: "bell", kind: "metal", geometry: bell, position: [0, 0, -0.74], rotation: [Math.PI / 2, 0, 0], group: "body" });
  const camera = new THREE.BoxGeometry(0.2, 0.16, 0.14, 4, 4, 4);
  add({ name: "camera", kind: "metal", geometry: camera, position: [0.3, 0.2, -0.6], rotation: [0, 0, 0], group: "body" });

  // Two star trackers with baffles, a whip antenna and two small patch antennas.
  for (const [index, x] of [-0.25, 0.25].entries()) {
    const tracker = new THREE.CylinderGeometry(0.07, 0.1, 0.16, 20, 2, true);
    add({ name: `tracker${index}`, kind: "metal", geometry: tracker, position: [x, -0.27, 0.66], rotation: [0, 0, 0.0], group: "body" });
  }
  const whip = new THREE.CylinderGeometry(0.008, 0.012, 1.0, 8, 6);
  add({ name: "whip", kind: "metal", geometry: whip, position: [-0.58, -0.2, 0.2], rotation: [0.5, 0, -0.35], group: "body" });
  for (const [index, y] of [-0.2, 0.2].entries()) {
    const patch = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 24, 1);
    add({ name: `patch${index}`, kind: "radiator", geometry: patch, position: [0.51, y, -0.1], rotation: [0, 0, Math.PI / 2], group: "body" });
  }

  // ---- solar-array wings: a boom, then three hinged panels, on each side ----
  for (const side of [1, -1] as const) {
    const group = side === 1 ? "wingPlus" : "wingMinus";
    const boom = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 14, 4);
    add({ name: `boom${side}`, kind: "metal", geometry: boom, position: [0, side * 0.72, 0], rotation: [0, 0, 0], group });
    for (let i = 0; i < 3; i++) {
      const panel = new THREE.BoxGeometry(0.78, 0.86, 0.028, 14, 14, 1);
      scaleUv(panel, 1, 1);
      add({ name: `panel${side}_${i}`, kind: "panel", geometry: panel, position: [0, side * (1.42 + i * 0.92), 0], rotation: [0, 0, 0], group });
      const hinge = new THREE.CylinderGeometry(0.022, 0.022, 0.7, 10, 1);
      add({ name: `hinge${side}_${i}`, kind: "metal", geometry: hinge, position: [0, side * (0.97 + i * 0.92), 0], rotation: [0, 0, Math.PI / 2], group });
    }
  }

  // ---- the high-gain dish on a boom (the page aims it at the Earth). In its own group the dish opens along +Y. ----
  const dishBoom = new THREE.CylinderGeometry(0.022, 0.028, 0.62, 12, 3);
  add({ name: "dishBoom", kind: "metal", geometry: dishBoom, position: [0, 0, 0.9], rotation: [Math.PI / 2, 0, 0], group: "body" });
  // A shallow paraboloid: depth = k r^2.
  const profile: ThreeNamespace.Vector2[] = [];
  const dishRadius = 0.46;
  for (let i = 0; i <= 14; i++) {
    const r = (i / 14) * dishRadius;
    profile.push(new THREE.Vector2(r, 0.5 * r * r / dishRadius));
  }
  const dishShape = new THREE.LatheGeometry(profile, 56);
  scaleUv(dishShape, 1, 1);
  add({ name: "dish", kind: "dish", geometry: dishShape, position: [0, 0, 0], rotation: [0, 0, 0], group: "dish" });
  const feed = new THREE.CylinderGeometry(0.02, 0.035, 0.09, 12, 1);
  add({ name: "feed", kind: "metal", geometry: feed, position: [0, 0.34, 0], rotation: [0, 0, 0], group: "dish" });
  for (let i = 0; i < 3; i++) {
    const strut = new THREE.CylinderGeometry(0.006, 0.006, 0.36, 5, 1);
    const angle = (i / 3) * Math.PI * 2;
    add({ name: `strut${i}`, kind: "metal", geometry: strut, position: [Math.cos(angle) * 0.2, 0.17, Math.sin(angle) * 0.2], rotation: [Math.sin(angle) * 0.5, 0, -Math.cos(angle) * 0.5], group: "dish" });
  }

  return parts;
}

/** Where the groups pivot: the dish sits on the end of its boom; the wings pivot at the bus. */
export const GROUP_ORIGIN: Record<SatellitePart["group"], [number, number, number]> = {
  body: [0, 0, 0],
  wingPlus: [0, 0, 0],
  wingMinus: [0, 0, 0],
  dish: [0, 0, 1.22],
};
