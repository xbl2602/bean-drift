// First screen: animated view from the Moon as a quiet background, title and call-to-action on top.

import Link from "next/link";
import { MoonSkyCanvas } from "./moon-sky-canvas";
import { Topbar } from "./topbar";

export function HeroSection() {
  return (
    <>
      <Topbar />

      <header className="lq-hero" id="home">
        <MoonSkyCanvas />
        <div className="lq-hero-scrim" aria-hidden="true" />

        <div className="lq-hero-copy">
          <p className="lq-kicker">Landing site navigator</p>
          <h1 className="lq-title">Lunar Quest</h1>
          <p className="lq-subtitle">
            Explore the Moon.
            <br />
            Discover the Perfect Landing Site.
          </p>
          <Link href="/product" className="lq-button">
            Try Now
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <p className="lq-scroll-hint" aria-hidden="true">
          Scroll
        </p>
      </header>
    </>
  );
}
