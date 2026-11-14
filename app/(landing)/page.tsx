// Landing page. Owner: chanjy0806. Order follows the hand-drawn plan:
// hero -> scroll story (Moon, Earth, Sun) -> mission tools -> famous landing sites -> Moon-POV gallery -> closing.
import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "@/ui/landing/hero-section";
import { LandingSites } from "@/ui/landing/landing-sites";
import { MissionTools } from "@/ui/landing/mission-tools";
import { PovGallery } from "@/ui/landing/pov-gallery";
import { ScrollStory } from "@/ui/landing/scroll-story";
import "@/ui/landing/landing.css";

export const metadata: Metadata = {
  title: "Lunar Quest · Discover the Perfect Landing Site",
  description:
    "Explore the Moon and compare landing sites by sunlight, solar elevation and Earth visibility, on any date.",
};

export default function LandingPage() {
  return (
    <div className="lq">
      <HeroSection />
      <main>
        <ScrollStory />
        <MissionTools />
        <LandingSites />
        <PovGallery />
        <section className="lq-section lq-closing" aria-labelledby="lq-closing-heading">
          <p className="lq-kicker">Ready for descent</p>
          <h2 id="lq-closing-heading" className="lq-section-heading">
            Compare coordinates. Choose your site.
          </h2>
          <p className="lq-section-lead">
            Put candidate locations side by side and see which one keeps the lights on and the link to Earth open.
          </p>
          <Link href="/product" className="lq-button">
            Try Now
            <span aria-hidden="true">→</span>
          </Link>
          <p className="lq-footer-note">
            Lunar Quest · NASA Space Apps Challenge · Built on NASA LOLA and LROC data
          </p>
        </section>
      </main>
    </div>
  );
}
