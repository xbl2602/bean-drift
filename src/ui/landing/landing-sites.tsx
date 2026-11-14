"use client";

// "Learn from real landings": three famous sites explained for beginners. The facts are fixed
// text; the "right now" line under each card is fetched live from our own /api/point, so visitors
// see the same Sun and Earth angles the product works with.

import { useEffect, useState } from "react";
import type { PointConditions } from "@/core/types";
import { angle, queryPoint } from "./demo-data";
import { FAMOUS_SITES, type FamousSite } from "./landing-sites-content";
import "./landing-sites.css";

type LiveSky = PointConditions | "failed" | undefined;

function formatCoordinates(site: FamousSite): string {
  const lat = `${Math.abs(site.latDeg).toFixed(3)}° ${site.latDeg >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(site.lonDeg).toFixed(3)}° ${site.lonDeg >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

function describeBody(name: string, elevationDeg: number): string {
  return `${name} ${angle(elevationDeg)} · ${elevationDeg >= 0 ? "above" : "below"} the horizon`;
}

function SiteCard({ site, index, sky }: { site: FamousSite; index: number; sky: LiveSky }) {
  // The map is a flat world map of the Moon: longitude -180..180 left to right, north at the top.
  const markerLeft = ((site.lonDeg + 180) / 360) * 100;
  const markerTop = ((90 - site.latDeg) / 180) * 100;

  return (
    <article className="lq-site">
      <div className="lq-site-map" role="img" aria-label={`Map of the Moon with ${site.mission} marked at ${formatCoordinates(site)}`}>
        <span className="lq-site-marker" style={{ left: `${markerLeft}%`, top: `${markerTop}%` }} />
        <span className="lq-site-map-label">Far side</span>
        <span className="lq-site-map-label">Near side</span>
        <span className="lq-site-map-label">Far side</span>
      </div>

      <div className="lq-site-body">
        <p className="lq-site-index">SITE {String(index + 1).padStart(2, "0")} · {site.landed}</p>
        <h3 className="lq-site-title">{site.mission}</h3>
        <p className="lq-site-place">{site.placeName}</p>
        <p className="lq-site-lesson">{site.lesson}</p>

        <dl className="lq-site-facts">
          <div>
            <dt>Coordinates</dt>
            <dd className="lq-site-mono">{formatCoordinates(site)}</dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{site.region}</dd>
          </div>
          <div>
            <dt>Who</dt>
            <dd>
              {site.agency}
              <br />
              {site.crew}
            </dd>
          </div>
          <div>
            <dt>Purpose</dt>
            <dd>{site.purpose}</dd>
          </div>
          <div>
            <dt>Sunlight</dt>
            <dd>{site.sunlight}</dd>
          </div>
          <div>
            <dt>Earth in the sky</dt>
            <dd>{site.earthView}</dd>
          </div>
          <div>
            <dt>Ground</dt>
            <dd>{site.ground}</dd>
          </div>
        </dl>

        <div className="lq-site-live" role="status">
          <p className="lq-site-live-title">Right now at this site</p>
          {sky === undefined && <p>Checking the sky…</p>}
          {sky === "failed" && <p>The live sky reading could not be loaded.</p>}
          {sky && sky !== "failed" && (
            <>
              <p>{describeBody("Sun", sky.sun.elevationDeg)}</p>
              <p>{describeBody("Earth", sky.earth.elevationDeg)}</p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function LandingSites() {
  const [skies, setSkies] = useState<LiveSky[]>(() => FAMOUS_SITES.map(() => undefined));

  useEffect(() => {
    const controller = new AbortController();
    const now = new Date().toISOString();
    FAMOUS_SITES.forEach((site, index) => {
      const store = (value: LiveSky) => {
        if (!controller.signal.aborted) setSkies((previous) => previous.map((item, i) => (i === index ? value : item)));
      };
      // Each site is asked separately, so one failed request does not blank the other two.
      queryPoint(site, now, controller.signal).then(store, () => store("failed"));
    });
    return () => controller.abort();
  }, []);

  return (
    <section className="lq-section lq-sites" id="landing-sites" aria-labelledby="lq-sites-heading">
      <p className="lq-kicker">Learn from real landings</p>
      <h2 id="lq-sites-heading" className="lq-section-heading">
        Three sites. Three lessons.
      </h2>
      <p className="lq-section-lead">
        New to landing sites? Start with three places spacecraft have already touched down, and see how location
        changes sunlight, the view of Earth and the ground under the lander.
      </p>
      <div className="lq-sites-grid">
        {FAMOUS_SITES.map((site, index) => (
          <SiteCard key={site.id} site={site} index={index} sky={skies[index]} />
        ))}
      </div>
      <p className="lq-sites-note">
        Live angles come from our ephemeris and are measured against a smooth Moon; nearby hills are not yet included.
        Map: NASA LRO.
      </p>
    </section>
  );
}
