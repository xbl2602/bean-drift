"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { searchLunarData, type SearchResult } from "./search-client";
import styles from "./lunar-search.module.css";
import { AnswerVisuals } from "./answer-visuals";
import { AnswerText } from "./answer-text";

const EXAMPLES = [
  { label: "Map my surroundings", question: "At 18.00°N 82.80°E, which named craters and landmarks are nearby? Show their positions and distances, and explain what this schematic cannot tell me." },
  { label: "Explore landing sites", question: "List the available lunar landing site presets and their coordinates." },
  { label: "Find flat sunny sites", question: "Find south polar sites south of -85 latitude with slope under 5 degrees and longest darkness under 400 hours." },
  { label: "Compare two locations", question: "Compare the lunar south pole and Apollo 11 at 2030-01-01T12:00:00Z." },
  { label: "14-day south pole timeline", question: "Show the sunlight and Earth visibility windows at the lunar south pole from 2030-01-01T00:00:00Z to 2030-01-15T00:00:00Z." },
  { label: "Sun + Earth together", question: "At latitude -89.9, longitude 0, show when the Sun and Earth are simultaneously visible during the 14 days starting 2030-01-01T00:00:00Z." },
  { label: "Longest dark period", question: "At latitude -89.9, longitude 0, what is the longest period without sunlight in the available annual statistics? State the statistics period and explain the power-planning limitation." },
  { label: "What can astronauts eat?", question: "Can astronauts find or grow food on the Moon? Explain what must be brought from Earth and which resources this lunar navigator cannot assess. Do not infer food or water availability from coordinates." },
];
const TOOL_LABELS: Record<string, string> = {
  lunar_gazetteer: "Nearby IAU landmarks",
  list_presets: "Lunar locations",
  get_point_conditions: "Point conditions",
  compare_points: "Site comparison",
  get_point_timeline: "Visibility timeline",
  compare_dates: "Date comparison",
  find_sites: "Site finder",
};

/**
 * Self-contained product-page widget. Calls only the site's /api/agent route.
 * `embedded` drops the card chrome, eyebrow and big title so it fits inside a panel that already has a title.
 */
export type SelectedLunarLocation = { latDeg: number; lonDeg: number; label: string; diameterKm?: number };
export function LunarSearch({ embedded = false, onSelectLocation }: { embedded?: boolean; onSelectLocation?: (location: SelectedLunarLocation) => void } = {}) {
  const id = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLElement>(null);
  const active = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  // In a side panel the answer lands below the examples; bring it into view so it does not look like nothing happened.
  useEffect(() => { if (embedded && result) answerRef.current?.scrollIntoView({ block: "start" }); }, [embedded, result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = question.trim();
    if (!message || message.length > 2000 || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true); setError(""); setNotice(""); setResult(null); setSubmitted(message);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
    try {
      const response = await searchLunarData(message, controller.signal);
      controller.signal.throwIfAborted();
      if (active.current === controller) { setResult(response); setNotice("Answer ready."); }
    } catch (cause) {
      if (active.current !== controller) return;
      if (controller.signal.aborted) {
        if (timedOut) setError("The search took too long. Please try again.");
        else setNotice("Search cancelled.");
      } else {
        setError(cause instanceof TypeError ? "Could not reach the assistant. Check your connection and try again." : cause instanceof Error ? cause.message : "Search failed. Please try again.");
      }
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { active.current = null; setPending(false); }
    }
  }

  function choose(question: string) { setQuestion(question); inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: "nearest" }); }

  return (
    <section className={embedded ? `${styles.panel} ${styles.embedded}` : styles.panel}
      aria-labelledby={embedded ? undefined : `${id}-title`} aria-label={embedded ? "Lunar assistant" : undefined}>
      {embedded ? null : <>
        <header className={styles.header}>
          <div className={styles.eyebrow}><span className={styles.orbit} aria-hidden="true" /> BEAN DRIFT / LUNAR ASSISTANT</div>
          <span className={styles.badge}>DEEPSEEK FLASH</span>
        </header>
        <h2 id={`${id}-title`} className={styles.title}>A question. A clearer view.</h2>
      </>}
      <p className={styles.subtitle}>Explore lunar locations, sunlight and Earth visibility with your own words.</p>
      <form onSubmit={submit} className={styles.form}>
        <label htmlFor={`${id}-question`} className={styles.label}>Ask about the Moon</label>
        <textarea ref={inputRef} id={`${id}-question`} value={question} onChange={event => setQuestion(event.target.value)}
          maxLength={2000} rows={3} disabled={pending} required
          placeholder="Where is the Sun above the horizon at the lunar south pole?"
          aria-describedby={`${id}-hint ${id}-count`} className={styles.input}
          onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) event.currentTarget.form?.requestSubmit();
          }} />
        <div className={styles.actions}>
          <span id={`${id}-count`} className={styles.count}>{question.length.toLocaleString("en-US")} / 2,000</span>
          {pending ? <button type="button" className={styles.cancel} onClick={() => active.current?.abort()}>Cancel search</button> : null}
          <button type="submit" className={styles.submit} disabled={pending || !question.trim()}>
            {pending ? "Searching…" : "Search the Moon"}<span aria-hidden="true"> ↗</span>
          </button>
        </div>
      </form>
      <p id={`${id}-hint`} className={styles.hint}>Include a location and UTC date. Each search is independent. Ctrl/Cmd + Enter to search.</p>
      <details className={styles.quickQuestions} open={!result}>
      <summary>Quick questions · choose a starting point</summary>
      <div className={styles.examples} aria-label="Example questions">
        {EXAMPLES.map(example => <button type="button" key={example.label} disabled={pending} onClick={() => choose(example.question)}>{example.label}<span aria-hidden="true"> +</span></button>)}
      </div>
      </details>
      <div role="status" aria-live="polite" className={styles.status}>{pending ? "Checking lunar tools. This may take a moment…" : notice}</div>
      {error ? <div role="alert" className={styles.error}>{error}<button type="button" onClick={() => inputRef.current?.focus()}>Edit question</button></div> : null}
      {result ? <article ref={answerRef} className={styles.answer} aria-label="Search answer">
        <div className={styles.answerHeader}><h3>Search result</h3><span>{result.model}</span></div>
        <p className={styles.question}>{submitted}</p>
        <AnswerVisuals sources={result.sources} onQuestion={choose} onSelectLocation={onSelectLocation} />
        <div className={styles.answerText}><AnswerText text={result.answer} /></div>
        {result.sources.length ? <div className={styles.sources}>
          <h4>Data sources · {result.sources.length}</h4>
          <p>Expand to inspect the inputs, returned values and provenance.</p>
          {result.sources.map((source, index) => <details key={`${source.tool}-${index}`}>
            <summary>{TOOL_LABELS[source.tool] ?? "Lunar tool"} <span>#{index + 1}</span></summary>
            <pre tabIndex={0} aria-label={`Data source ${index + 1}`}>{JSON.stringify({ input: source.input, result: source.result }, null, 2)}</pre>
          </details>)}
        </div> : <p className={styles.hint}>No structured lunar data source was returned for this answer.</p>}
      </article> : null}
      <footer className={styles.footer}><span aria-hidden="true">◌</span><p>Exploration, not mission planning. Positions use an analytical approximation; terrain uses a coarse whole-Moon map. Annual statistics currently cover 2030, independent of the selected date. Check each result’s provenance and period.</p></footer>
    </section>
  );
}

