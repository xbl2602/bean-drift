// Three pictures taken from the Moon's point of view. They are screenshots of our own first-person
// lunar scene (see docs/CREDITS.md), not photographs.

import Image from "next/image";

const POV_SHOTS = [
  {
    src: "/landing/moon-pov-south-pole-earthrise.jpg",
    alt: "Rendered view from the lunar south pole with the Earth above a sunlit ridge",
    site: "South Pole",
    caption: "Earth above the ridge",
  },
  {
    src: "/landing/moon-pov-south-pole-crater-rim.jpg",
    alt: "Rendered view across a shadowed crater rim near the lunar south pole",
    site: "South Pole",
    caption: "Along the crater rim",
  },
  {
    src: "/landing/moon-pov-apollo-11.jpg",
    alt: "Rendered view across the flat plain of the Apollo 11 landing site",
    site: "Apollo 11 · Tranquility Base",
    caption: "The open plain",
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
            <div className="lq-shot-frame">
              {/* unoptimized: show the original file at full quality instead of a re-compressed copy */}
              <Image src={shot.src} alt={shot.alt} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized />
            </div>
            <figcaption>
              <span className="lq-shot-index">POV {String(i + 1).padStart(2, "0")}</span>
              <span className="lq-shot-caption">{shot.caption}</span>
              <span className="lq-shot-site">{shot.site}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
