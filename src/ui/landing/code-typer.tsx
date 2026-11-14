"use client";

// A small "terminal" that types out example requests to our API and MCP server, one character at
// a time. The first example's reply is fetched from the real /api/point, so the numbers shown are
// what the service actually returns. Typing only starts once the terminal scrolls into view.

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointConditions } from "@/core/types";
import { DEMO_EPOCH, DEMO_SITES, queryPoint } from "./demo-data";

const SITE = DEMO_SITES[0];
const REQUEST_PATH = `/api/point?latDeg=${SITE.latDeg}&lonDeg=${SITE.lonDeg}&time=${DEMO_EPOCH}`;
const CHARS_PER_SECOND = 85;
const HOLD_WHEN_DONE_MS = 4200;

type Snippet = { title: string; text: string };

function restSnippet(point: PointConditions | "failed" | undefined): Snippet {
  const lines = [`$ curl "https://your-site${REQUEST_PATH}"`];
  if (point === undefined) {
    lines.push("# waiting for the live reply...");
  } else if (point === "failed") {
    lines.push("# the live reply could not be loaded just now");
  } else {
    lines.push(
      "{",
      `  "position": { "latDeg": ${point.position.latDeg}, "lonDeg": ${point.position.lonDeg} },`,
      `  "timeUtc": "${point.timeUtc}",`,
      `  "sun":   { "azimuthDeg": ${point.sun.azimuthDeg}, "elevationDeg": ${point.sun.elevationDeg} },`,
      `  "earth": { "azimuthDeg": ${point.earth.azimuthDeg}, "elevationDeg": ${point.earth.elevationDeg},`,
      `             "distanceKm": ${point.earth.distanceKm} },`,
      "  ...",
      "}",
      "# live reply from this site, shortened",
    );
  }
  return { title: "REST API", text: lines.join("\n") };
}

const MCP_SNIPPET: Snippet = {
  title: "MCP",
  text: [
    "$ POST /mcp",
    "{",
    '  "jsonrpc": "2.0", "id": 1, "method": "tools/call",',
    '  "params": {',
    '    "name": "compare_points",',
    '    "arguments": { "points": [',
    `      { "latDeg": ${DEMO_SITES[0].latDeg}, "lonDeg": ${DEMO_SITES[0].lonDeg} },`,
    `      { "latDeg": ${DEMO_SITES[1].latDeg}, "lonDeg": ${DEMO_SITES[1].lonDeg} }`,
    "    ] }",
    "  }",
    "}",
    "# an AI client gets both sites back, side by side",
  ].join("\n"),
};

function lineClass(line: string): string | undefined {
  if (line.startsWith("$")) return "is-command";
  if (line.startsWith("#")) return "is-comment";
  return undefined;
}

export function CodeTyper() {
  const paneRef = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<PointConditions | "failed">();
  const [isVisible, setIsVisible] = useState(false);
  const [snippetIndex, setSnippetIndex] = useState(0);
  const [shownChars, setShownChars] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const snippets = useMemo(() => [restSnippet(point), MCP_SNIPPET], [point]);
  const snippet = snippets[snippetIndex];
  const tallestLineCount = Math.max(...snippets.map((item) => item.text.split("\n").length), 12);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const controller = new AbortController();
    queryPoint(SITE, DEMO_EPOCH, controller.signal)
      .then(setPoint)
      .catch(() => {
        if (!controller.signal.aborted) setPoint("failed");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  // Type while visible; when a snippet is complete, pause, then start the next one.
  // Progress follows the clock rather than counting timer ticks, so the speed stays the same
  // even when the browser slows timers down (for example in a background tab).
  const isComplete = shownChars >= snippet.text.length;
  useEffect(() => {
    if (!isVisible || reducedMotion) return;
    if (isComplete) {
      const timer = window.setTimeout(() => {
        setSnippetIndex((index) => (index + 1) % snippets.length);
        setShownChars(0);
      }, HOLD_WHEN_DONE_MS);
      return () => window.clearTimeout(timer);
    }
    let lastMs = performance.now();
    let carry = 0;
    const timer = window.setInterval(() => {
      const nowMs = performance.now();
      carry += ((nowMs - lastMs) / 1000) * CHARS_PER_SECOND;
      lastMs = nowMs;
      const whole = Math.floor(carry);
      if (whole > 0) {
        carry -= whole;
        setShownChars((count) => count + whole);
      }
    }, 30);
    return () => window.clearInterval(timer);
  }, [isVisible, reducedMotion, isComplete, snippetIndex, snippets.length]);

  const typed = reducedMotion ? snippet.text : snippet.text.slice(0, shownChars);
  const isTyping = !reducedMotion && !isComplete;
  const allLines = snippet.text.split("\n");

  return (
    <div ref={paneRef} className="lq-terminal">
      <div className="lq-terminal-bar">
        <span className="lq-terminal-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="lq-terminal-tabs">
          {snippets.map((item, i) => (
            <button
              key={item.title}
              type="button"
              aria-pressed={i === snippetIndex}
              onClick={() => {
                setSnippetIndex(i);
                setShownChars(0);
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>
      {/* Screen readers get the whole example at once instead of a stream of single letters. */}
      <pre
        className="lq-terminal-screen"
        aria-label={`${snippet.title} example: ${snippet.text}`}
        style={{ minHeight: `calc(${tallestLineCount} * 1.6em + 2rem)` }}
      >
        <code aria-hidden="true">
          {typed.split("\n").map((line, i, lines) => (
            <span key={i} className={lineClass(allLines[i])}>
              {line}
              {i < lines.length - 1 && "\n"}
            </span>
          ))}
          {isTyping && <span className="lq-terminal-caret" />}
        </code>
      </pre>
    </div>
  );
}
