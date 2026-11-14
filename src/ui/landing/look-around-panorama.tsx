"use client";

// "Stand there first": a wide first-person panorama that turns to follow your cursor, as if you
// were looking around from the spot. Scrolling also advances into the scene, including on touch.

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const FOLLOW_PER_S = 4.5;
/** The picture is drawn a little taller than its window so it can also tilt up and down. */
const EXTRA_HEIGHT = 0.14;

export function LookAroundPanorama({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  const windowRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [hasMoved, setHasMoved] = useState(false);

  useEffect(() => {
    const frame = windowRef.current;
    const picture = imageRef.current;
    if (!frame || !picture) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0.5, y: 0.5, isOver: false };
    const view = { x: 0.27, y: 0.71 };
    const card = frame.closest<HTMLElement>(".lq-card-horizon") ?? frame;
    const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
    let isVisible = false;
    let frameRequest = 0;
    let lastMs = performance.now();
    let zoom = 1;

    const onMove = (event: PointerEvent) => {
      if (reducedMotion || event.pointerType === "touch") return;
      const box = card.getBoundingClientRect();
      pointer.x = clamp01((event.clientX - box.left) / box.width);
      pointer.y = clamp01((event.clientY - box.top) / box.height);
      pointer.isOver = true;
      setHasMoved(true);
    };
    const onLeave = () => {
      pointer.isOver = false;
    };

    const draw = (nowMs: number) => {
      frameRequest = isVisible ? requestAnimationFrame(draw) : 0;
      const stepS = Math.min((nowMs - lastMs) / 1000, 0.1);
      lastMs = nowMs;
      const rect = frame.getBoundingClientRect();
      const progress = reducedMotion ? 0.5 : clamp01((window.innerHeight * 0.8 - rect.top) / (window.innerHeight * 0.58));
      const targetX = clamp01(0.27 + 0.18 * progress + (pointer.isOver ? (pointer.x - 0.5) * 0.68 : 0));
      const targetY = clamp01(0.62 + 0.16 * progress + (pointer.isOver ? (pointer.y - 0.5) * 0.56 : 0));
      const follow = reducedMotion ? 1 : 1 - Math.exp(-stepS * FOLLOW_PER_S);
      zoom += (1 + (reducedMotion ? 0 : progress * 0.2) - zoom) * follow;
      view.x += (targetX - view.x) * follow;
      view.y += (targetY - view.y) * follow;

      const frameWidth = frame.clientWidth;
      const frameHeight = frame.clientHeight;
      const pictureHeight = frameHeight * (1 + EXTRA_HEIGHT) * zoom;
      const pictureWidth = Math.max((pictureHeight * width) / height, frameWidth);
      picture.style.width = `${pictureWidth}px`;
      picture.style.height = `${pictureHeight}px`;
      const shiftX = -(pictureWidth - frameWidth) * view.x;
      const shiftY = -(pictureHeight - frameHeight) * view.y;
      picture.style.transform = `translate3d(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px, 0)`;
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible && frameRequest === 0) {
        lastMs = performance.now();
        frameRequest = requestAnimationFrame(draw);
      }
    });
    observer.observe(frame);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
    card.addEventListener("pointercancel", onLeave);

    return () => {
      observer.disconnect();
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerleave", onLeave);
      card.removeEventListener("pointercancel", onLeave);
      if (frameRequest !== 0) cancelAnimationFrame(frameRequest);
    };
  }, [width, height]);

  return (
    <div ref={windowRef} className="lq-pov-window lq-look">
      <div ref={imageRef} className="lq-look-picture">
        {/* unoptimized: show the original file at full quality instead of a re-compressed copy */}
        <Image src={src} alt={alt} width={width} height={height} sizes="100vw" unoptimized draggable={false} />
      </div>
      <span className={`lq-look-hint${hasMoved ? " is-hidden" : ""}`} aria-hidden="true">
        Scroll to approach · Move to look around
      </span>
    </div>
  );
}
