"use client";
// 第一人称顶部的罗盘带：显示当前朝向（0° = 正北，向东增加），并标出太阳和地球所在的方位。

const VISIBLE_SPAN_DEG = 120;
const TICK_STEP_DEG = 15;
const CARDINALS: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };

/** 方位差，规范到 [-180, 180)。 */
const angleDelta = (azimuthDeg: number, headingDeg: number) => ((((azimuthDeg - headingDeg) % 360) + 540) % 360) - 180;

interface CompassTapeProps {
  headingDeg: number;
  sunAzimuthDeg: number | null;
  earthAzimuthDeg: number | null;
}

export function CompassTape({ headingDeg, sunAzimuthDeg, earthAzimuthDeg }: CompassTapeProps) {
  const ticks: Array<{ azimuthDeg: number; offsetPct: number }> = [];
  for (let azimuthDeg = 0; azimuthDeg < 360; azimuthDeg += TICK_STEP_DEG) {
    const delta = angleDelta(azimuthDeg, headingDeg);
    if (Math.abs(delta) <= VISIBLE_SPAN_DEG / 2) ticks.push({ azimuthDeg, offsetPct: 50 + (delta / VISIBLE_SPAN_DEG) * 100 });
  }
  const marker = (azimuthDeg: number | null, label: string, className: string) => {
    if (azimuthDeg === null) return null;
    const delta = angleDelta(azimuthDeg, headingDeg);
    if (Math.abs(delta) > VISIBLE_SPAN_DEG / 2) return null;
    return (
      <span className={`absolute top-0 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-semibold ${className}`} style={{ left: `${50 + (delta / VISIBLE_SPAN_DEG) * 100}%` }}>
        {label}
      </span>
    );
  };

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 w-[min(26rem,calc(100vw-22rem))] min-w-40 -translate-x-1/2 sm:top-6" aria-label={`Heading ${Math.round(headingDeg)} degrees`}>
      <div className="relative h-11 overflow-hidden rounded-full border border-white/10 bg-black/50 lunar-glass backdrop-blur-md">
        {ticks.map(({ azimuthDeg, offsetPct }) => (
          <span key={azimuthDeg} className="absolute bottom-1 -translate-x-1/2 text-center" style={{ left: `${offsetPct}%` }}>
            <span className={`block text-[11px] leading-none ${CARDINALS[azimuthDeg] ? "font-semibold text-white" : "text-white/40"}`}>{CARDINALS[azimuthDeg] ?? azimuthDeg}</span>
            <span className="mx-auto mt-0.5 block h-1.5 w-px bg-white/40" />
          </span>
        ))}
        {marker(sunAzimuthDeg, "Sun", "bg-amber-300 text-black")}
        {marker(earthAzimuthDeg, "Earth", "bg-sky-400 text-black")}
        <span className="absolute bottom-0 left-1/2 h-3 w-0.5 -translate-x-1/2 bg-lime-300" />
      </div>
      <p className="mt-1 text-center font-mono text-[11px] text-white/70">{Math.round(headingDeg) % 360}°</p>
    </div>
  );
}
