"use client";
// 教程：几步卡片，第一次打开产品页时自动出现一次（记在浏览器本地，读写失败就当没看过）。
import { useEffect, useState } from "react";

const STEPS = [
  { title: "Welcome to Lunar Quest", body: "Explore the whole Moon in 4K, built from NASA Lunar Reconnaissance Orbiter data, and find a good place to land." },
  { title: "2D map and 3D globe", body: "The 2D map is the default: drag to pan (it wraps all the way round) and scroll or pinch to zoom. Switch to 3D at the top right, then drag to spin the Moon and scroll to fly closer." },
  { title: "Time, Sun and shadows", body: "Use the timeline at the bottom: drag it or press play. The Sun moves to its real position for that time, so the day–night line and the shadows cast by mountains and crater rims move with it. Shadows always point away from the Sun." },
  { title: "Stand anywhere", body: "Click any spot on the 2D or 3D map to land there in first person. Drag to look around a full 360°, scroll to rise, and watch the shadows change as you move the timeline. “Back to map” returns." },
  { title: "Find and pick sites", body: "Open the Lunar Quest button at the top left. Search Location finds named craters or coordinates. Select Landing Site saves a marker wherever you click. Measure Distance adds up a path between clicks." },
  { title: "Analyse and compare", body: "Terrain & Elevation, Solar Illumination, Temperature, Water Ice Potential, Surface Slope and Site Suitability each colour the map and show a legend. Compare Locations puts your saved sites side by side, and Export Results downloads them. Layers marked “model” are estimates, not measurements." },
];

const SEEN_KEY = "lunar-quest:tutorial-seen";

export function useFirstVisitTutorial(open: () => void) {
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 隐私模式等情况下存储不可用：不影响使用，照常显示教程
    }
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在首次挂载时判断
  }, []);
}

export function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="tutorial-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0f17]/95 p-6 text-white shadow-2xl shadow-black/70">
        <p className="text-xs uppercase tracking-[0.2em] text-lime-300/80">
          Tutorial · {step + 1} / {STEPS.length}
        </p>
        <h2 id="tutorial-title" className="mt-2 text-2xl font-semibold">{STEPS[step].title}</h2>
        <p className="mt-3 leading-relaxed text-white/75">{STEPS[step].body}</p>
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-lime-300" : "w-1.5 bg-white/25"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-full px-4 py-2 text-sm text-white/70 hover:bg-white/10">
                Back
              </button>
            )}
            <button type="button" onClick={() => (last ? onClose() : setStep(step + 1))} className="rounded-full bg-lime-300 px-5 py-2 text-sm font-medium text-black hover:bg-lime-200">
              {last ? "Start exploring" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
