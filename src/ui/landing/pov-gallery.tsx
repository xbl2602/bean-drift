// Three high-resolution pictures taken from the Moon's point of view. They are screenshots of our own first-person
// lunar scene (see docs/CREDITS.md), not photographs.

import Image from "next/image";

const POV_SHOTS = [
  {
    src: "/landing/shot-earthrise-hd.jpg",
    alt: "Rendered view from the lunar south pole with the Earth above a sunlit ridge",
    site: "South Pole",
    detail: "A view across the crater rim toward Earth.",
    caption: "Earthrise at the pole",
  },
  {
    src: "/landing/shot-crater-rim-hd.jpg",
    alt: "Rendered view over a sunlit slope near the lunar south pole, with Earth peeking over the ridge",
    site: "South Pole",
    detail: "Look for the smaller craters on the sunlit slope.",
    caption: "Earth over the ridge",
  },
  {
    src: "/landing/shot-long-shadows-hd.jpg",
    alt: "Rendered view across lunar south polar ground with long shadows and the Sun low in the sky",
    site: "South Pole",
    detail: "Low sunlight reveals the shape of the terrain.",
    caption: "Long shadows, low Sun",
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
        Frames from our first-person scene, rendered on real NASA terrain data with the Sun and Earth placed by
        ephemeris.
      </p>
      <div className="lq-gallery">
        {POV_SHOTS.map((shot, i) => (
          <figure key={shot.src} className="lq-shot">
            <a className="lq-shot-frame" href={shot.src} target="_blank" rel="noopener noreferrer" aria-label={`Open full-resolution render: ${shot.caption}`}>
              {/* unoptimized: show the original file at full quality instead of a re-compressed copy */}
              <Image src={shot.src} alt={shot.alt} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized />
              <span className="lq-shot-full" aria-hidden="true">FULL RES ↗</span>
            </a>
            <figcaption>
              <span className="lq-shot-index">POV {String(i + 1).padStart(2, "0")}</span>
              <span className="lq-shot-caption">{shot.caption}</span>
              <span className="lq-shot-site">{shot.site}</span>
              <span className="lq-shot-detail">{shot.detail}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
