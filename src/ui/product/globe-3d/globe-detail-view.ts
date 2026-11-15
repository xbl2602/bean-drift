import * as THREE from "three";
import { bodyToLatLon, threeToBody } from "../moon-frames";
import type { DetailView } from "../imagery/tile-atlas";

export function globeDetailView(camera: THREE.PerspectiveCamera, widthPx: number, radiusKm: number): DetailView | null {
  if (camera.position.length() > radiusKm * 2.2) return null;
  const center = bodyToLatLon(threeToBody(camera.position));
  const centerU = center.lonDeg / 360 + 0.5;
  const raycaster = new THREE.Raycaster();
  const sphere = new THREE.Sphere(new THREE.Vector3(), radiusKm);
  const samples: Array<{ u: number; v: number }> = [];
  for (const y of [-1, -0.5, 0, 0.5, 1]) for (const x of [-1, -0.5, 0, 0.5, 1]) {
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const hit = raycaster.ray.intersectSphere(sphere, new THREE.Vector3());
    if (!hit) continue;
    const point = bodyToLatLon(threeToBody(hit));
    let du = point.lonDeg / 360 + 0.5 - centerU;
    du -= Math.round(du);
    samples.push({ u: centerU + du, v: point.latDeg / 180 + 0.5 });
  }
  if (!samples.length) return null;
  const west = Math.min(...samples.map((p) => p.u)), east = Math.max(...samples.map((p) => p.u));
  return { west, east, south: Math.max(0, Math.min(...samples.map((p) => p.v))), north: Math.min(1, Math.max(...samples.map((p) => p.v))), worldWidthPx: widthPx / Math.max(east - west, 0.0001) };
}
