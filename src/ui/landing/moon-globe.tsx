"use client";

// A small Moon in the corner of the all-sky chart: the Moon seen from straight above the site
// (North at the top, East on the right, the site at the centre), lit by the Sun exactly as it is at
// the chosen time. It shows what the dome cannot: whether the ground under you is in daylight, how
// close it is to the sunrise or sunset line, and which way the Sun and Earth lie around the site.
// The Moon's own orbit is ignored; the picture is centred on the Moon, as in the sky chart.
// Surface colours come from the NASA colour map already used elsewhere on the page.

import { useEffect, useRef } from "react";

type Direction = { azimuthDeg: number; elevationDeg: number };

const DEG = Math.PI / 180;
const SIZE = 144; // drawing size in pixels; the canvas is shown smaller so it stays sharp
const GLOBE_RADIUS = 56;
const MAP_URL = "/landing/moon-color-4k.jpg";
const MAP_WIDTH = 1024;
const MAP_HEIGHT = 512;

/** East, north, up. */
function toVector({ azimuthDeg, elevationDeg }: Direction): [number, number, number] {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
}

type SurfaceMap = { data: Uint8ClampedArray };

/** The colour of the ground seen from above the site, drawn once; shading is applied per frame. */
function bakeDisc(map: SurfaceMap, latDeg: number, lonDeg: number): { rgb: Float32Array; normal: Float32Array } {
  const rgb = new Float32Array(SIZE * SIZE * 3);
  const normal = new Float32Array(SIZE * SIZE * 3); // east, north, up of the surface, or all zero outside the disc
  const lat0 = latDeg * DEG;
  const lon0 = lonDeg * DEG;
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const x = (px + 0.5 - SIZE / 2) / GLOBE_RADIUS;
      const y = -(py + 0.5 - SIZE / 2) / GLOBE_RADIUS;
      const rho = Math.hypot(x, y);
      if (rho > 1) continue;
      const c = Math.asin(rho);
      const lat = rho === 0 ? lat0 : Math.asin(Math.cos(c) * Math.sin(lat0) + (y * Math.sin(c) * Math.cos(lat0)) / rho);
      const lon = lon0 + Math.atan2(x * Math.sin(c), rho * Math.cos(lat0) * Math.cos(c) - y * Math.sin(lat0) * Math.sin(c));
      const u = (((lon / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
      const v = 0.5 - lat / Math.PI;
      const mx = Math.min(MAP_WIDTH - 1, Math.floor(u * MAP_WIDTH));
      const my = Math.min(MAP_HEIGHT - 1, Math.max(0, Math.floor(v * MAP_HEIGHT)));
      const at = (my * MAP_WIDTH + mx) * 4;
      const o = (py * SIZE + px) * 3;
      rgb.set([map.data[at] / 255, map.data[at + 1] / 255, map.data[at + 2] / 255], o);
      normal.set([x, y, Math.sqrt(Math.max(0, 1 - rho * rho))], o);
    }
  }
  return { rgb, normal };
}

export function MoonGlobe({ sun, earth, latDeg, lonDeg }: { sun: Direction; earth: Direction; latDeg: number; lonDeg: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const discRef = useRef<{ rgb: Float32Array; normal: Float32Array } | null>(null);
  const skyRef = useRef({ sun, earth });
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    skyRef.current = { sun, earth };
    drawRef.current();
  }, [sun, earth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let isDisposed = false;

    const draw = () => {
      context.clearRect(0, 0, SIZE, SIZE);
      const disc = discRef.current;
      if (!disc) return;
      const { sun: sunDirection, earth: earthDirection } = skyRef.current;
      const light = toVector(sunDirection);
      const earthLight = toVector(earthDirection);
      const image = context.createImageData(SIZE, SIZE);
      for (let i = 0; i < SIZE * SIZE; i++) {
        const o = i * 3;
        const nz = disc.normal[o + 2];
        if (nz === 0 && disc.normal[o] === 0 && disc.normal[o + 1] === 0) continue;
        const facing = disc.normal[o] * light[0] + disc.normal[o + 1] * light[1] + nz * light[2];
        const sunlit = Math.min(1, Math.max(0, (facing + 0.04) / 0.14)) * Math.max(0, facing) ** 0.45; // soft sunrise line
        const earthshine = Math.max(0, disc.normal[o] * earthLight[0] + disc.normal[o + 1] * earthLight[1] + nz * earthLight[2]) * 0.05;
        const shade = 0.035 + 1.05 * sunlit + earthshine;
        const limb = 0.55 + 0.45 * Math.sqrt(nz); // slight darkening at the edge, as a real photo has
        const px = i * 4;
        image.data[px] = Math.min(255, disc.rgb[o] * shade * limb * 330);
        image.data[px + 1] = Math.min(255, disc.rgb[o + 1] * shade * limb * 330);
        image.data[px + 2] = Math.min(255, disc.rgb[o + 2] * shade * limb * 345 + 4);
        image.data[px + 3] = 255;
      }
      context.putImageData(image, 0, 0);

      // The site, at the centre of the disc.
      context.strokeStyle = "#ffe08a";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(SIZE / 2, SIZE / 2, 5, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "#ffe08a";
      context.beginPath();
      context.arc(SIZE / 2, SIZE / 2, 1.6, 0, Math.PI * 2);
      context.fill();

      // The Sun and Earth around the rim, in the direction they lie from the site (filled: above the horizon).
      const marker = (direction: Direction, colour: string, size: number) => {
        const az = direction.azimuthDeg * DEG;
        const x = SIZE / 2 + Math.sin(az) * (GLOBE_RADIUS + 9);
        const y = SIZE / 2 - Math.cos(az) * (GLOBE_RADIUS + 9);
        const isUp = direction.elevationDeg >= 0;
        context.globalAlpha = isUp ? 1 : 0.4;
        context.fillStyle = colour;
        context.strokeStyle = colour;
        context.lineWidth = 1.6;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        if (isUp) context.fill();
        else context.stroke();
        context.globalAlpha = 1;
      };
      marker(sunDirection, "#ffd66b", 4.6);
      marker(earthDirection, "#6cc4ff", 3.6);
    };
    drawRef.current = draw;

    const image = new Image();
    image.src = MAP_URL;
    image
      .decode()
      .then(() => {
        if (isDisposed) return;
        const scratch = document.createElement("canvas");
        scratch.width = MAP_WIDTH;
        scratch.height = MAP_HEIGHT;
        const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
        if (!scratchContext) return;
        scratchContext.drawImage(image, 0, 0, MAP_WIDTH, MAP_HEIGHT);
        discRef.current = bakeDisc({ data: scratchContext.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data }, latDeg, lonDeg);
        draw();
      })
      .catch((error: unknown) => console.error("Moon globe map failed to load:", error));
    return () => {
      isDisposed = true;
      drawRef.current = () => {};
    };
  }, [latDeg, lonDeg]);

  return <canvas ref={canvasRef} className="lq-moon-globe" width={SIZE} height={SIZE} aria-hidden="true" />;
}
