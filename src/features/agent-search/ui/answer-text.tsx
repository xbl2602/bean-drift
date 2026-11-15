import { Fragment } from "react";

// A small text-only formatter: never interpret model HTML, images, URLs or scripts.
function inline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

export function AnswerText({ text }: { text: string }) {
  return <>{text.split(/\n\s*\n/).map((block, i) => {
    const lines = block.split("\n");
    if (lines.every(line => /^\s*[-•*]\s+/.test(line))) return <ul key={i}>{lines.map((line, j) => <li key={j}>{inline(line.replace(/^\s*[-•*]\s+/, ""))}</li>)}</ul>;
    if (lines.length === 1 && /^#{1,4}\s/.test(block)) return <h4 key={i}>{inline(block.replace(/^#{1,4}\s+/, ""))}</h4>;
    return <p key={i}>{lines.map((line, j) => <Fragment key={j}>{j > 0 ? <br /> : null}{inline(line)}</Fragment>)}</p>;
  })}</>;
}
