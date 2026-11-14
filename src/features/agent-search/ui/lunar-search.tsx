"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { searchLunarData, type SearchResult } from "./search-client";
import styles from "./lunar-search.module.css";

const EXAMPLES = [
  { label: "Explore landing sites", question: "List the available lunar landing site presets and their coordinates." },
  { label: "Sun at the south pole", question: "What is the Sun's elevation at the lunar south pole at 2030-01-01T12:00:00Z?" },
  { label: "Compare two locations", question: "Compare the lunar south pole and Apollo 11 at 2030-01-01T12:00:00Z." },
];
const TOOL_LABELS: Record<string, string> = {
  list_presets: "Lunar locations", get_point_conditions: "Point conditions", compare_points: "Site comparison",
};

/** Self-contained product-page widget. Calls only the site's /api/agent route. */
export function LunarSearch() {
  const id = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const active = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

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

  function choose(question: string) { setQuestion(question); inputRef.current?.focus(); }

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.eyebrow}><span className={styles.orbit} aria-hidden="true" /> BEAN DRIFT / LUNAR ASSISTANT</div>
        <span className={styles.badge}>DEEPSEEK FLASH</span>
      </header>
      <h2 id={`${id}-title`} className={styles.title}>A question. A clearer view.</h2>
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
      <p id={`${id}-hint`} className={styles.hint}>Include a location and UTC date for a specific calculation. Each search is independent.</p>
      <div className={styles.examples} aria-label="Example questions">
        {EXAMPLES.map(example => <button type="button" key={example.label} disabled={pending} onClick={() => choose(example.question)}>{example.label}<span aria-hidden="true"> +</span></button>)}
      </div>
      <div role="status" aria-live="polite" className={styles.status}>{pending ? "Checking lunar tools. This may take a moment…" : notice}</div>
      {error ? <div role="alert" className={styles.error}>{error}<button type="button" onClick={() => inputRef.current?.focus()}>Edit question</button></div> : null}
      {result ? <article className={styles.answer} aria-label="Search answer">
        <div className={styles.answerHeader}><h3>Search result</h3><span>{result.model}</span></div>
        <p className={styles.question}>{submitted}</p>
        <div className={styles.answerText}>{result.answer}</div>
        {result.sources.length ? <div className={styles.sources}>
          <h4>Tool data · {result.sources.length}</h4>
          <p>Expand to inspect the inputs, returned values and provenance.</p>
          {result.sources.map((source, index) => <details key={`${source.tool}-${index}`}>
            <summary>{TOOL_LABELS[source.tool] ?? "Lunar tool"} <span>#{index + 1}</span></summary>
            <pre tabIndex={0} aria-label={`Data source ${index + 1}`}>{JSON.stringify({ input: source.input, result: source.result }, null, 2)}</pre>
          </details>)}
        </div> : <p className={styles.hint}>No lunar calculation tool was used for this answer.</p>}
      </article> : null}
      <footer className={styles.footer}><span aria-hidden="true">◌</span><p>Exploration, not mission planning. Positions use an analytical approximation. Terrain obstruction and yearly statistics are not yet available.</p></footer>
    </section>
  );
}
