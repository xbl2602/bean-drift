"use client";

import { useEffect, useRef, useState } from "react";
import type { Preset } from "@/core/types";
import { CodeTyper } from "./code-typer";
import { AnalysisNetwork } from "./analysis-network";
import { angle, DEMO_EPOCH, DEMO_SITES, queryPoint } from "./demo-data";
import { type ReplySegment, TypedReply } from "./typed-reply";
import "./mission-tools.css";

const PROMPTS = [
  { question: "How high is the Sun at Ridge A?", body: "sun", site: DEMO_SITES[0] },
  { question: "Can I see Earth from Apollo 11?", body: "earth", site: DEMO_SITES[2] },
] as const;

/** Turns a live reading into a short plain-language answer, with the key words tagged for colour. */
function composeAnswer(prompt: (typeof PROMPTS)[number], elevationDeg: number): ReplySegment[] {
  const isUp = elevationDeg >= 0;
  const heightWord = isUp ? "above" : "below";
  if (prompt.body === "sun") {
    return [
      { text: "The Sun", tone: "sun" },
      { text: " is " },
      { text: angle(elevationDeg), tone: "value" },
      { text: ` ${heightWord} the horizon at ` },
      { text: prompt.site.name, tone: "place" },
      { text: ". " },
      { text: isUp ? "A low Sun means long shadows." : "It is night there, so solar power is zero.", tone: "note" },
    ];
  }
  return [
    { text: isUp ? "Yes" : "Not right now", tone: isUp ? "good" : "warn" },
    { text: " — " },
    { text: "Earth", tone: "earth" },
    { text: " is " },
    { text: angle(elevationDeg), tone: "value" },
    { text: ` ${heightWord} the horizon at ` },
    { text: prompt.site.name, tone: "place" },
    { text: ". " },
    { text: "Nearby hills can still block the view.", tone: "note" },
  ];
}

export function MissionTools() {
  const [answer, setAnswer] = useState<ReplySegment[]>([]);
  const [failedMessage, setFailedMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState<(typeof PROMPTS)[number]>();
  const query = useRef<AbortController | null>(null);
  const [mcpStatus, setMcpStatus] = useState("");
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [presetStatus, setPresetStatus] = useState<"idle" | "loading" | "error">("idle");

  const previewPresets = presets?.slice(0, 3);

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
    setAnswer([]);
    setFailedMessage("");
    try {
      const point = await queryPoint(selected.site, DEMO_EPOCH, controller.signal);
      if (controller.signal.aborted) return;
      setAnswer(composeAnswer(selected, point[selected.body].elevationDeg));
    } catch {
      if (!controller.signal.aborted) setFailedMessage("Couldn’t load the answer. Choose a question to try again.");
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
      <div className="lq-tools-overview">
        <div className="lq-tools-intro">
          <p className="lq-kicker">04 / Console</p>
          <h2 className="lq-group-heading" id="lq-tools-heading">Explore lunar data your way.</h2>
          <p className="lq-section-lead">Start with a question or bring Lunar Quest data into your own app.</p>
        </div>
        <AnalysisNetwork />
      </div>
      <div className="lq-tools-grid">
        <article className="lq-tool lq-tool-assistant">
          <span className="lq-hud-tag" aria-hidden="true">CH-01 · ASSISTANT</span>
          <div className="lq-tool-copy">
            <p className="lq-kicker">AI assistant preview</p>
            <h3>Ask in plain language.</h3>
            <p>Ask in everyday words and the built-in AI runs the right query for you.</p>
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
            {isLoading && (
              <p className="lq-chat-reply lq-chat-thinking" role="status">
                Checking lunar data<span aria-hidden="true" className="lq-thinking-dots"><i /><i /><i /></span>
              </p>
            )}
            {!isLoading && answer.length > 0 && <TypedReply segments={answer} />}
            {!isLoading && answer.length === 0 && (
              <p className="lq-chat-reply" role="status">{failedMessage || "Pick a question to try."}</p>
            )}
          </div>
        </article>
        <article className="lq-tool lq-tool-integrations">
          <span className="lq-hud-tag" aria-hidden="true">CH-02 · API + MCP</span>
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
              {presets && previewPresets && (
                <div className="lq-api-result">
                  <p><code>GET /api/presets</code> <span>Showing {previewPresets.length} of {presets.length}</span></p>
                  <ul>
                    {previewPresets.map(({ id, name, position }) => (
                      <li key={id}><span>{name}</span><code>{position.latDeg.toFixed(2)}°, {position.lonDeg.toFixed(2)}°</code></li>
                    ))}
                  </ul>
                  <a href="/api/presets" target="_blank" rel="noopener noreferrer">View all presets as JSON ↗</a>
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
