"use client";

import { useEffect, useRef, useState } from "react";
import type { Preset } from "@/core/types";
import { CodeTyper } from "./code-typer";
import { angle, DEMO_EPOCH, DEMO_SITES, queryPoint } from "./demo-data";
import "./mission-tools.css";

const PROMPTS = [
  { question: "How high is the Sun at Ridge A?", body: "sun", site: DEMO_SITES[0] },
  { question: "Can I see Earth from Apollo 11?", body: "earth", site: DEMO_SITES[2] },
] as const;

export function MissionTools() {
  const [exampleResult, setExampleResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState<(typeof PROMPTS)[number]>();
  const query = useRef<AbortController | null>(null);
  const [mcpStatus, setMcpStatus] = useState("");
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [presetStatus, setPresetStatus] = useState<"idle" | "loading" | "error">("idle");

  async function loadPresets() {
    setPresetStatus("loading");
    try {
      const response = await fetch("/api/presets");
      if (!response.ok) throw new Error("Preset query failed");
      const data: { presets: Preset[] } = await response.json();
      setPresets(data.presets);
      setPresetStatus("idle");
    } catch {
      setPresetStatus("error");
    }
  }

  useEffect(() => () => query.current?.abort(), []);

  async function runExample(selected: (typeof PROMPTS)[number]) {
    query.current?.abort();
    const controller = new AbortController();
    query.current = controller;
    setPrompt(selected);
    setIsLoading(true);
    setExampleResult("");
    try {
      const point = await queryPoint(selected.site, DEMO_EPOCH, controller.signal);
      if (controller.signal.aborted) return;
      const elevation = point[selected.body].elevationDeg;
      setExampleResult(`${selected.body === "sun" ? "The Sun" : "Earth"} is at ${angle(elevation)} relative to the Moon’s reference horizon. Local terrain can affect visibility.`);
    } catch {
      if (!controller.signal.aborted) setExampleResult("Couldn’t load the answer. Choose a question to try again.");
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }

  async function copyMcpUrl() {
    const url = new URL("/mcp", window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setMcpStatus("MCP endpoint copied.");
    } catch {
      setMcpStatus(url);
    }
  }

  return (
    <section className="lq-section lq-tools" id="mission-tools" aria-labelledby="lq-tools-heading">
      <div className="lq-tools-intro">
        <h2 className="lq-section-heading" id="lq-tools-heading">Explore lunar data your way.</h2>
        <p className="lq-section-lead">Start with a question or bring Lunar Quest data into your own app.</p>
      </div>
      <div className="lq-tools-grid">
        <article className="lq-tool lq-tool-assistant">
          <div className="lq-tool-copy">
            <p className="lq-kicker">AI assistant preview</p>
            <h3>Ask in plain language.</h3>
            <p>New to lunar data? Type what you want to know in everyday words and the built-in AI runs the right query for you.</p>
            <div className="lq-chat-prompts">
              {PROMPTS.map(option => (
                <button key={option.question} className="lq-tool-action" type="button" onClick={() => void runExample(option)}>{option.question}</button>
              ))}
            </div>
            <p>Guided preview · free-text input is in development.</p>
          </div>
          <div className="lq-chat">
            <p className="lq-demo-caption">14 NOV 2026 · 12:00 UTC</p>
            {prompt && <blockquote>{prompt.question}</blockquote>}
            <p className="lq-chat-reply" role="status">{isLoading ? "Checking lunar data…" : exampleResult || "Pick a question to try."}</p>
          </div>
        </article>
        <article className="lq-tool lq-tool-integrations">
          {/* Left: example requests typed out. Right: what they mean. */}
          <CodeTyper />
          <div className="lq-tool-copy">
          <p className="lq-kicker">API + MCP</p>
          <h3>Bring the Moon into your app.</h3>
          <div className="lq-data-flow" aria-label="Lunar Quest sends lunar data to your program">
            <span>Lunar Quest</span><span aria-hidden="true">⟶</span><span>Your program</span>
          </div>
          <div className="lq-integration-row">
            <div>
              <h4>REST API</h4>
              <p>Scripts and apps can fetch landing sites, Sun and Earth positions, and site comparisons as JSON.</p>
            </div>
            <button className="lq-tool-action" type="button" onClick={loadPresets} disabled={presetStatus === "loading"}>
              {presetStatus === "loading" ? "Loading sites…" : "Preview API data"}
            </button>
          </div>
          <div className="lq-api-preview" aria-live="polite">
            {presetStatus === "error" && <p>Couldn’t load the landing sites. Try again.</p>}
            {presets && (
              <div className="lq-api-result">
                <p><code>GET /api/presets</code> <span>{presets.length} landing sites</span></p>
                <ul>
                  {presets.map(({ id, name, position }) => (
                    <li key={id}><span>{name}</span><code>{position.latDeg.toFixed(2)}°, {position.lonDeg.toFixed(2)}°</code></li>
                  ))}
                </ul>
                <a href="/api/presets" target="_blank" rel="noopener noreferrer">Open raw JSON in a new tab ↗</a>
              </div>
            )}
          </div>
          <div className="lq-integration-row">
            <div>
              <h4>MCP</h4>
              <p>Connect an external AI client to the same lunar query tools via Streamable HTTP.</p>
            </div>
            <button className="lq-tool-action" type="button" onClick={copyMcpUrl}>Copy MCP endpoint</button>
          </div>
          <p role="status">{mcpStatus}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
