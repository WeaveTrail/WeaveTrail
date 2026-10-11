import React from "react";

/** Splits prose into its sentences, keeping each one's closing mark. */
export function sentences(prose: string): string[] {
  return prose.split(/(?<=[.?!])\s+/);
}

/**
 * Sets each sentence on its own line, so a line ends where a sentence does
 * rather than in the middle of one. Takes the sentences as a list, or prose
 * that it splits.
 */
export function SentenceLines({
  className,
  lines,
}: {
  className?: string;
  lines: readonly string[] | string;
}) {
  const shown = typeof lines === "string" ? sentences(lines) : lines;
  return (
    <p className={className ? `${className} sentence-lines` : "sentence-lines"}>
      {shown.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </p>
  );
}

/**
 * A heading may mark where it can break with `|`, between phrases. Each
 * phrase is kept whole, so a narrow screen breaks a heading between phrases
 * rather than in the middle of one.
 */
export function Phrased({ text }: { text: string }) {
  const phrases = text.split("|");
  return (
    <>
      {phrases.map((phrase, index) => (
        <React.Fragment key={phrase}>
          {index > 0 ? " " : null}
          <span className="phrase">{phrase.trim()}</span>
        </React.Fragment>
      ))}
    </>
  );
}

/** A phrase-marked heading as a reader sees it. */
export function plainText(text: string): string {
  return text
    .split("|")
    .map((phrase) => phrase.trim())
    .join(" ");
}
