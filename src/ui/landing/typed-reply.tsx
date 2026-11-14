"use client";

// The assistant's answer, typed out one character at a time with the important words coloured.
// Visitors with "reduce motion" switched on get the whole answer at once.

import { useEffect, useMemo, useState } from "react";

export type ReplyTone = "sun" | "earth" | "value" | "place" | "good" | "warn" | "note";
export type ReplySegment = { text: string; tone?: ReplyTone };

const CHARS_PER_SECOND = 48;

export function TypedReply({ segments }: { segments: ReplySegment[] }) {
  const fullText = useMemo(() => segments.map((segment) => segment.text).join(""), [segments]);
  const [shown, setShown] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    setShown(0);
    let lastMs = performance.now();
    let carry = 0;
    const timer = window.setInterval(() => {
      const nowMs = performance.now();
      carry += ((nowMs - lastMs) / 1000) * CHARS_PER_SECOND;
      lastMs = nowMs;
      const whole = Math.floor(carry);
      if (whole <= 0) return;
      carry -= whole;
      setShown((count) => Math.min(count + whole, fullText.length));
    }, 30);
    return () => window.clearInterval(timer);
  }, [fullText]);

  const visibleCount = reducedMotion ? fullText.length : shown;
  const isTyping = visibleCount < fullText.length;
  let remaining = visibleCount;

  return (
    <p className="lq-typed" role="status" aria-label={fullText}>
      <span aria-hidden="true">
        {segments.map((segment, index) => {
          const part = segment.text.slice(0, Math.max(remaining, 0));
          remaining -= segment.text.length;
          if (!part) return null;
          return (
            <span key={index} className={segment.tone ? `lq-tone lq-tone-${segment.tone}` : undefined}>
              {part}
            </span>
          );
        })}
        {isTyping && <span className="lq-terminal-caret" />}
      </span>
    </p>
  );
}
