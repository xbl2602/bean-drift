// First screen: animated view from the Moon as a quiet background, title and call-to-action on top.

import Link from "next/link";
import { MoonSkyCanvas } from "./moon-sky-canvas";

export function HeroSection() {
  return (
    <>
      <nav className="lq-topbar" aria-label="Main">
        <Link className="lq-wordmark" href="#home">Lunar Quest</Link>
        <span className="lq-topbar-note">NASA Space Apps Challenge · Lunar Landing Site Navigator</span>
        <div className="lq-topbar-actions">
          <Link className="lq-topbar-tools" href="#mission-tools">AI &amp; integrations</Link>
          <Link href="/product" className="lq-button lq-topbar-cta">
            Try Now <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </nav>

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
