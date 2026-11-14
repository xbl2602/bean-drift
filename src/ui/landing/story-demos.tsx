import Image from "next/image";
import type { CSSProperties } from "react";
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
          <div className="lq-pov-window">
            <Image src="/landing/moon-pov-south-pole-crater-rim.jpg" alt="First-person view across Shackleton crater rim, with rough lunar ground in the foreground" width={960} height={540} sizes="100vw" unoptimized />
          </div>
          <figcaption className="lq-demo-caption">SHACKLETON RIM · FIRST-PERSON VIEW</figcaption>
        </figure>
      );
    case "forecast":
      return <SkyForecast />;
    case "clock":
      return (
        <div className="lq-demo lq-progress-demo">
          <p className="lq-demo-caption">EXAMPLE · 30-DAY SURFACE MISSION · ILLUSTRATIVE NUMBERS</p>
          <div className="lq-gauges">
            {MISSION_GAUGES.map((gauge) => (
              <div
                key={gauge.label}
                className="lq-gauge"
                role="img"
                aria-label={`${gauge.label}: ${gauge.percent} percent, ${gauge.detail}`}
              >
                <div
                  className="lq-gauge-ring"
                  style={{ "--lq-gauge-value": gauge.percent, "--lq-gauge-color": gauge.color } as CSSProperties}
                >
                  <strong>{gauge.percent}%</strong>
                </div>
                <div>
                  <span className="lq-gauge-label">{gauge.label}</span>
                  <span className="lq-gauge-detail">{gauge.detail}</span>
                </div>
              </div>
            ))}
          </div>
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
