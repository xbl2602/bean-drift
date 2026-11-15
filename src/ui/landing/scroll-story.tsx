"use client";

// The scroll-driven middle of the landing page. The section is very tall; inside it a full-screen
// "stage" stays pinned while the user scrolls, and scroll distance drives the Moon, Earth and Sun.
// Positions come from story-timeline.ts and the drawing from space-renderer.ts; this file connects
// them to the page and reveals the feature cards.

import { useCallback, useEffect, useRef } from "react";
import { STORY_CHAPTERS } from "./feature-content";
import { StoryDemo } from "./story-demos";
import { clamp01, globeRotation, lightFromScreen } from "./space-math";
import { createSpaceRenderer, MOON_COLOR_6K_URL, type SpaceBody, type SpaceScene } from "./space-renderer";
import { computeStoryFrame } from "./story-timeline";
import { useAnimatedCanvas } from "./use-animated-canvas";
import "./story-demos.css";

/** The Moon grows to fill the screen here, so it gets the sharper 6144-pixel colour map. */
const createStoryRenderer = (canvas: HTMLCanvasElement) => createSpaceRenderer(canvas, { moonColorUrl: MOON_COLOR_6K_URL });

const CARD_STAGGER = 0.45;
/** How quickly the scene catches up with the scrollbar, per second; lower = smoother, floatier. */
const SCROLL_CATCH_UP_PER_S = 9;
const TWO_PI = Math.PI * 2;
/** Breathing room kept above and below a chapter's cards, in CSS pixels. */
const GROUP_MARGIN_PX = 16;
/** Never shrink a chapter below this fraction: smaller would be unreadable (shorter screens use the stacked layout instead). */
const MIN_GROUP_FIT = 0.55;

/** Cards in a group appear one after another as the group's visibility goes 0 -> 1. */
function revealCardGroup(group: HTMLElement | null, visibility: number): void {
  if (!group) return;
  group.style.visibility = visibility > 0.001 ? "visible" : "hidden";
  group.style.pointerEvents = visibility > 0.6 ? "auto" : "none";
  // CSS animations that should replay each time a chapter comes into view hang off this class.
  group.classList.toggle("is-live", visibility > 0.7);
  const items = group.querySelectorAll<HTMLElement>("[data-reveal]");
  const span = 1 + CARD_STAGGER * (items.length - 1);
  items.forEach((item, i) => {
    const local = clamp01(visibility * span - i * CARD_STAGGER);
    item.style.opacity = local.toFixed(3);
    item.style.transform = `translate3d(0, ${((1 - local) * 36).toFixed(1)}px, 0)`;
  });
}

export function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railRefs = useRef<(HTMLLIElement | null)[]>([]);
  const shownProgressRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const buildScene = useCallback((timeS: number, widthPx: number, heightPx: number): SpaceScene => {
    const section = sectionRef.current;
    let targetProgress = 0;
    if (section) {
      const rect = section.getBoundingClientRect();
      const scrollableDistancePx = rect.height - heightPx;
      targetProgress = scrollableDistancePx > 0 ? clamp01(-rect.top / scrollableDistancePx) : 0;
    }
    // Ease towards the scrollbar so mouse-wheel steps become a glide instead of a jump. The step is
    // based on elapsed time, so it feels the same on 60 Hz and 144 Hz screens. When time is frozen
    // (reduced-motion setting) there is no glide and the scene follows the scrollbar exactly.
    const elapsedS = timeS - lastTimeRef.current;
    lastTimeRef.current = timeS;
    const previous = shownProgressRef.current ?? targetProgress;
    const catchUp = elapsedS > 0 ? 1 - Math.exp(-elapsedS * SCROLL_CATCH_UP_PER_S) : 1;
    const progress =
      Math.abs(targetProgress - previous) < 0.0004 ? targetProgress : previous + (targetProgress - previous) * catchUp;
    shownProgressRef.current = progress;

    const frame = computeStoryFrame(progress, widthPx, heightPx);
    frame.groupVisibility.forEach((visibility, i) => revealCardGroup(groupRefs.current[i] ?? null, visibility));
    railRefs.current.forEach((item, i) => item?.classList.toggle("is-active", i === frame.activeChapter));

    const sun: SpaceBody = {
      kind: "sun",
      ...frame.sun,
      rotation: globeRotation(0, 0, 0),
      light: [0, 0, 1],
    };
    const moon: SpaceBody = {
      kind: "moon",
      ...frame.moon,
      // Slow real-time turn plus a little extra as you scroll, so it never looks like a flat picture.
      rotation: globeRotation(0.35 + timeS * 0.06 + progress * 1.4, 0.12, 0.1),
      light: lightFromScreen(frame.moon.xPx, frame.moon.yPx, frame.sun.xPx, frame.sun.yPx, 0.6),
    };
    const earth: SpaceBody = {
      kind: "earth",
      ...frame.earth,
      rotation: globeRotation(2.2 + timeS * 0.16 + frame.earthScrollTurns * TWO_PI, 0.22, 0.41),
      light: lightFromScreen(frame.earth.xPx, frame.earth.yPx, frame.sun.xPx, frame.sun.yPx, 0.6),
    };

    return {
      timeS,
      starDriftPx: progress * 420 + timeS * 0.8,
      bodies: frame.earthInFrontOfMoon ? [sun, moon, earth] : [sun, earth, moon],
    };
  }, []);

  useAnimatedCanvas(canvasRef, createStoryRenderer, buildScene, 0, true);

  // The chapters are centred in the space below the fixed bar. If a screen is too short for a whole chapter, shrink that
  // chapter (never below MIN_GROUP_FIT) instead of letting its top slide under the bar and its bottom off the screen.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const barPx = parseFloat(getComputedStyle(stage).getPropertyValue("--lq-bar-h")) * parseFloat(getComputedStyle(document.documentElement).fontSize) || 68;
      const availablePx = stage.clientHeight - barPx - 2 * GROUP_MARGIN_PX;
      groupRefs.current.forEach((group) => {
        if (!group) return;
        // offsetHeight ignores transforms, so shrinking a group does not change what is measured here
        const naturalPx = group.offsetHeight;
        const scale = naturalPx > availablePx && naturalPx > 0 ? Math.max(availablePx / naturalPx, MIN_GROUP_FIT) : 1;
        group.style.setProperty("--lq-fit", scale.toFixed(3));
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    groupRefs.current.forEach((group) => group && observer.observe(group));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="lq-story" aria-label="What Lunar Quest does">
      {/* Scrolls past while the Moon rises behind it: numbers on the left, the view on the right. */}
      <section className="lq-moon-demos" aria-labelledby="lq-moon-heading">
        <header className="lq-moon-intro">
          <p className="lq-kicker">01 / Moon</p>
          <h2 id="lq-moon-heading" className="lq-group-heading">{STORY_CHAPTERS[0].heading}</h2>
        </header>
        <article className="lq-card lq-card-survey">
          <h3 className="lq-card-title">{STORY_CHAPTERS[0].cards[0].title}</h3>
          <StoryDemo kind="survey" />
        </article>
        <article className="lq-card lq-card-horizon">
          <h3 className="lq-card-title">{STORY_CHAPTERS[0].cards[1].title}</h3>
          <StoryDemo kind="horizon" />
          <p className="lq-demo-note">
            Drop into a first-person view of any site. See where the Sun and Earth sit in the sky, and spot craters
            and slopes before you commit.
          </p>
        </article>
      </section>
      <div ref={stageRef} className="lq-stage">
        <canvas ref={canvasRef} className="lq-space-canvas lq-stage-canvas" aria-hidden="true" />

        {STORY_CHAPTERS.slice(1).map((chapter, index) => (
          <div
            key={chapter.id}
            ref={(element) => {
              groupRefs.current[index + 1] = element;
            }}
            className={`lq-group lq-group-${chapter.id}`}
          >
            <header className="lq-group-header" data-reveal>
              <p className="lq-kicker">
                {chapter.index} / {chapter.label}
              </p>
              <h2 className="lq-group-heading">{chapter.heading}</h2>
            </header>
            <div className="lq-cards">
              {chapter.cards.map((card) => (
                <article key={card.kind} className={`lq-card lq-card-${card.kind}`} data-reveal>
                  <h3 className="lq-card-title">{card.title}</h3>
                  <StoryDemo kind={card.kind} />
                </article>
              ))}
            </div>
          </div>
        ))}

        <ol className="lq-rail" aria-hidden="true">
          {STORY_CHAPTERS.map((chapter, i) => (
            <li
              key={chapter.id}
              ref={(element) => {
                railRefs.current[i] = element;
              }}
            >
              <span>{chapter.index}</span>
              {chapter.label}
            </li>
          ))}
        </ol>
      </div>

    </section>
  );
}
