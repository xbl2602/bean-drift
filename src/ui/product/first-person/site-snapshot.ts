"use client";
// 对比表里每个候选点的"站在这里看一眼"照片：和第一人称是同一个场景（真实 LOLA 地形、真实太阳方向和阴影），
// 同样的开场朝向和 1.6 m 眼高，在离屏画布上画一张 2K（2560×1440）的照片。
// 整页只开一个离屏 WebGL 渲染器，一次画一张（排队），画完立即释放这个点的场景，避免显存被几个 8K 贴图占满。
import { useEffect, useState } from "react";
import * as THREE from "three";
import type { LatLon } from "../moon-frames";
import { buildFirstPersonScene, configureFirstPersonRenderer, OPENING_PITCH_DEG, openingYawDeg } from "./first-person-scene";

/** 2K（2560×1440）：照片放大看也清楚。 */
const SNAPSHOT_WIDTH_PX = 2560;
const SNAPSHOT_HEIGHT_PX = 1440;
const EYE_HEIGHT_M = 1.6;
/** 最多缓存这么多张照片（2K JPEG 每张约 0.5 MB）；超出时丢掉最早的。 */
const CACHE_LIMIT = 24;

let renderer: THREE.WebGLRenderer | null = null;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string>>();

const snapshotKey = (point: LatLon, timeMs: number) => `${point.latDeg.toFixed(4)},${point.lonDeg.toFixed(4)}@${timeMs}`;

function sharedRenderer(): THREE.WebGLRenderer {
  if (renderer) return renderer;
  // preserveDrawingBuffer：画完后读像素时缓冲区还在
  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
  configureFirstPersonRenderer(renderer);
  renderer.setSize(SNAPSHOT_WIDTH_PX, SNAPSHOT_HEIGHT_PX, false);
  return renderer;
}

async function renderSnapshot(point: LatLon, timeMs: number): Promise<string> {
  const target = sharedRenderer();
  const built = await buildFirstPersonScene(point, target);
  try {
    built.camera.aspect = SNAPSHOT_WIDTH_PX / SNAPSHOT_HEIGHT_PX;
    built.camera.updateProjectionMatrix();
    built.setView(openingYawDeg(point, timeMs), OPENING_PITCH_DEG, EYE_HEIGHT_M);
    built.setTime(timeMs);
    target.render(built.scene, built.camera);
    const blob = await new Promise<Blob | null>((resolve) => target.domElement.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("Snapshot could not be encoded");
    return URL.createObjectURL(blob);
  } finally {
    built.dispose();
  }
}

/** 某个点在某个时刻的第一人称照片（blob URL）。同一点同一时刻只画一次。 */
export function siteSnapshotUrl(point: LatLon, timeMs: number): Promise<string> {
  const key = snapshotKey(point, timeMs);
  const cached = cache.get(key);
  if (cached) return cached;
  const job = queue.then(() => renderSnapshot(point, timeMs));
  queue = job.catch(() => undefined);
  cache.set(key, job);
  job.catch(() => cache.delete(key)); // 失败的不缓存，下次再试
  while (cache.size > CACHE_LIMIT) {
    const [oldestKey, oldest] = cache.entries().next().value!;
    cache.delete(oldestKey);
    void oldest.then((url) => URL.revokeObjectURL(url), () => undefined);
  }
  return job;
}

export type SnapshotState = { status: "loading" } | { status: "ready"; url: string } | { status: "error" };

export function useSiteSnapshot(point: LatLon, timeMs: number): SnapshotState {
  const key = snapshotKey(point, timeMs);
  const [state, setState] = useState<{ key: string; value: SnapshotState }>({ key, value: { status: "loading" } });
  useEffect(() => {
    let cancelled = false;
    siteSnapshotUrl(point, timeMs).then(
      (url) => !cancelled && setState({ key, value: { status: "ready", url } }),
      () => !cancelled && setState({ key, value: { status: "error" } }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key 已包含 point 和 timeMs
  }, [key]);
  return state.key === key ? state.value : { status: "loading" };
}
