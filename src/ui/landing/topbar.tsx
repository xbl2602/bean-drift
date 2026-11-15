"use client";

// The fixed bar at the top of the landing page. It slides out of the way while the visitor scrolls down and comes back
// as soon as they scroll up (or reach the top), so headings never end up half-hidden under it, whatever the screen size.
// While a link or button inside the bar has keyboard focus, the bar stays put.

import Link from "next/link";
import { useEffect, useState } from "react";

/** Always show the bar this close to the top of the page. */
const ALWAYS_SHOWN_ABOVE_PX = 96;
/** Ignore tiny scroll movements (trackpad jitter) so the bar does not flicker. */
const MIN_STEP_PX = 6;

export function Topbar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (y < ALWAYS_SHOWN_ABOVE_PX) setHidden(false);
      else if (y - lastY > MIN_STEP_PX) setHidden(true);
      else if (lastY - y > MIN_STEP_PX) setHidden(false);
      else return; // moved less than a step: keep the last position as the reference
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav className="lq-topbar" data-hidden={hidden} aria-label="Main">
      <Link className="lq-wordmark" href="#home">Lunar Quest</Link>
      <span className="lq-topbar-note">NASA Space Apps Challenge · Lunar Landing Site Navigator</span>
      <div className="lq-topbar-actions">
        <Link className="lq-topbar-tools" href="#mission-tools">AI &amp; integrations</Link>
        <Link href="/product" className="lq-button lq-topbar-cta">
          Try Now <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </nav>
  );
}
