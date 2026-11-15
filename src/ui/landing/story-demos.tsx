import type { CSSProperties } from "react";
import { MissionGauges } from "./mission-gauges";
import { LookAroundPanorama } from "./look-around-panorama";
import { SiteSurvey } from "./site-survey";
import { SkyForecast } from "./sky-forecast";

// What the mission clock card tracks. The numbers are a made-up example to show the idea;
// the product works them out from your own mission plan.
const MISSION_GAUGES = [
  { label: "Mission time", percent: 60, detail: "18 of 30 days", color: "var(--lq-accent)" },
  { label: "Fuel used", percent: 42, detail: "58% in reserve", color: "#ff9d6c" },
  { label: "Sunlight collected", percent: 71, detail: "of power target", color: "var(--lq-sun)" },
  { label: "Communication done", percent: 54, detail: "13 of 24 Earth links", color: "#7bd8ff" },
];

export function StoryDemo({ kind }: { kind: "survey" | "horizon" | "forecast" | "clock" | "goal" }) {
  switch (kind) {
    case "survey":
      return <SiteSurvey />;
    case "horizon":
      return (
        <figure className="lq-demo lq-pov-demo">
          <LookAroundPanorama
            src="/landing/apollo-15-hadley.webp"
            alt="Sunlit lunar hills, boulders and the Apollo 15 rover at Hadley–Apennine"
            width={3200}
            height={572}
          />
          <figcaption className="lq-demo-caption">APOLLO 15 · HADLEY–APENNINE · NASA / USGS</figcaption>
        </figure>
      );
    case "forecast":
      return <SkyForecast />;
    case "clock":
      return (
        <div className="lq-demo lq-progress-demo">
          <p className="lq-demo-caption">EXAMPLE · 30-DAY SURFACE MISSION · ILLUSTRATIVE NUMBERS</p>
          <MissionGauges />

        </div>
      );
    case "goal":
      return (
        <div className="lq-demo lq-goal-demo">
          <p className="lq-demo-caption">EXAMPLE MISSION</p>
          <p className="lq-goal-statement">Build a base.<br /><em>Stay for a year.</em></p>
          <ol className="lq-goal-route">
            <li>Scout the ridge</li><li>Find reliable sunlight</li><li>Keep a link to Earth</li>
          </ol>
        </div>
      );
  }
}
