import type { CSSProperties } from "react";

type Direction = { azimuthDeg: number; elevationDeg: number };

const COMPASS = ["N", "E", "S", "W", "N"];

// Cylindrical panorama: north is the seam. Each marker has a copy across it so an
// object at north crosses the edge smoothly instead of jumping across the sky.
function Body({ name, direction }: { name: "sun" | "earth"; direction: Direction }) {
  if (direction.elevationDeg < -3) return null;
  const x = direction.azimuthDeg / 360;
  const y = 1 - direction.elevationDeg / 90;
  return [-1, 0, 1].map((offset) => (
    <i
      key={offset}
      className="lq-horizon-body"
      data-body={name}
      style={{ "--sky-opacity": Math.min(1, (90 - direction.elevationDeg) / 6), "--sky-x": `${(x + offset) * 100}%`, "--sky-y": `${y * 100}%` } as CSSProperties}
    />
  ));
}

export function HorizonForecast({ sky }: { sky: { sun: Direction; earth: Direction } }) {
  return (
    <div className="lq-forecast-panorama" aria-hidden="true">
      <div className="lq-horizon-air">
        <Body name="sun" direction={sky.sun} />
        <Body name="earth" direction={sky.earth} />
      </div>
      <div className="lq-horizon-ground" />
      <div className="lq-horizon-cardinals">{COMPASS.map((letter, i) => <span key={i}>{letter}</span>)}</div>
    </div>
  );
}
