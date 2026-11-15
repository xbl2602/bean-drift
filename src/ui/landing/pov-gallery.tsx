// Three pictures taken from the Moon's point of view: screenshots of our own first-person scene (see docs/CREDITS.md),
// not photographs. The place, time and Sun height are written on each picture; the Earth heights below come from the
// same ephemeris the product uses (checked against the stamps on the pictures).

import Image from "next/image";

const POV_SHOTS = [
  {
    src: "/landing/pov-low-sun-earth-up.webp",
    alt: "First-person view from the Moon at 64.07 degrees north: a low Sun rakes across a cratered plain, and the Earth hangs above the horizon inside the blue loop it traces over a month",
    caption: "A low Sun, Earth in view",
    place: "64.07°N 42.80°E",
    time: "2026-11-15 09:09 UTC",
    sun: "8.4° above the horizon",
    earth: "20.2° above the horizon",
    detail: "A Sun this low stretches every shadow. Earth does not stay put: the blue loop is its path over a month.",
  },
  {
    src: "/landing/pov-far-side-no-earth.webp",
    alt: "First-person view from the far side of the Moon at 177.95 degrees east: a high Sun over a rolling grey plain, with the Sun's dotted path rising almost straight up and no Earth in the sky",
    caption: "The far side: no Earth",
    place: "6.44°N 177.95°E",
    time: "2026-12-14 07:08 UTC",
    sun: "29.7° above the horizon",
    earth: "Below the horizon, never visible here",
    detail: "From the far side the Earth never rises, so a lander here needs a relay satellite to reach home.",
  },
  {
    src: "/landing/pov-earth-on-horizon.webp",
    alt: "First-person view from the Moon at 30.38 degrees north: the Sun stands above a boulder-strewn plain, and the Earth's blue loop sits just above the distant horizon",
    caption: "Earth skimming the horizon",
    place: "30.38°N 78.15°E",
    time: "2026-11-23 03:37 UTC",
    sun: "22.4° above the horizon",
    earth: "2.4° above the horizon",
    detail: "Near the edge of the Earth-facing side, Earth sits right on the horizon, and a small ridge can hide it.",
  },
];

export function PovGallery() {
  return (
    <section className="lq-section" aria-labelledby="lq-gallery-heading">
      <p className="lq-kicker">Field of view</p>
      <h2 id="lq-gallery-heading" className="lq-section-heading">
        Captured from the Moon.
      </h2>
      <p className="lq-section-lead">
        Frames from our first-person view, rendered on real NASA terrain data with the Sun and Earth placed by
        ephemeris. The dotted gold line is the Sun&apos;s path across the sky; the blue loop is the Earth&apos;s.
      </p>
      <div className="lq-gallery">
        {POV_SHOTS.map((shot, i) => (
          <figure key={shot.src} className="lq-shot">
            <a className="lq-shot-frame" href={shot.src} target="_blank" rel="noopener noreferrer" aria-label={`Open full-resolution picture: ${shot.caption}`}>
              {/* unoptimized: show the original file at full quality instead of a re-compressed copy */}
              <Image src={shot.src} alt={shot.alt} width={2000} height={905} sizes="(max-width: 900px) 100vw, 62vw" unoptimized />
              <span className="lq-shot-full" aria-hidden="true">FULL RES ↗</span>
            </a>
            <figcaption>
              <span className="lq-shot-index">POV {String(i + 1).padStart(2, "0")}</span>
              <span className="lq-shot-caption">{shot.caption}</span>
              <dl className="lq-shot-facts">
                <div><dt>Place</dt><dd>{shot.place}</dd></div>
                <div><dt>Time</dt><dd>{shot.time}</dd></div>
                <div><dt>Sun</dt><dd>{shot.sun}</dd></div>
                <div><dt>Earth</dt><dd>{shot.earth}</dd></div>
              </dl>
              <span className="lq-shot-detail">{shot.detail}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
