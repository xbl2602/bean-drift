import { Fragment } from "react";

// A small text-only formatter: never interpret model HTML, images, URLs or scripts.
function inline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

function renderBlock(block: string, key: number) {
  const lines = block.split("\n");
  if (lines.every(line => /^\s*[-•*]\s+/.test(line))) return <ul key={key}>{lines.map((line, j) => <li key={j}>{inline(line.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>;
  if (lines.length === 1 && /^#{1,4}\s/.test(block)) return <h4 key={key}>{inline(block.replace(/^#{1,4}\s+/, ""))}</h4>;
  return <p key={key}>{lines.map((line, j) => <Fragment key={j}>{j > 0 ? <br /> : null}{inline(line)}</Fragment>)}</p>;
}

export function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  if (blocks.length <= 2) return <>{blocks.map((block, i) => renderBlock(block, i))}</>;
  const primary = blocks.slice(0, 2);
  const extra = blocks.slice(2);
  return <>
    {primary.map((block, i) => renderBlock(block, i))}
    <details style={{ marginTop: "8px" }}>
      <summary style={{ cursor: "pointer", fontSize: "12px", color: "#c9e59b" }}>More telemetry & data caveats</summary>
      <div style={{ marginTop: "8px" }}>{extra.map((block, i) => renderBlock(block, i + 2))}</div>
    </details>
  </>;
}
