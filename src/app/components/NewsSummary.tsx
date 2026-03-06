"use client";

import { type ReactNode } from "react";

interface NewsSummaryProps {
  summary: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  periodStart: Date | null;
  articleCount: number | null;
}

function formatPeriod(date: Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const end = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  const fmt = (dt: Date) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    }).format(dt);
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
  return `${dateFmt}, ${fmt(d)}\u2013${fmt(end)} UTC`;
}

const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  name: { bg: "var(--color-highlight-letter)", color: "var(--color-highlight-letter-text)" },
  ticker: { bg: "var(--color-highlight-letter)", color: "var(--color-highlight-letter-text)" },
  price: { bg: "var(--color-highlight-number)", color: "var(--color-highlight-number-text)" },
  pct: { bg: "var(--color-highlight-number)", color: "var(--color-highlight-number-text)" },
  date: { bg: "var(--color-highlight-number)", color: "var(--color-highlight-number-text)" },
};

function highlightText(text: string): ReactNode[] {
  const pattern = /\[(name|ticker|price|pct|date)\](.*?)\[\/\1\]/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const tag = match[1];
    const content = match[2];
    const style = TAG_STYLES[tag] || TAG_STYLES.name;

    parts.push(
      <span
        key={key++}
        style={{
          backgroundColor: style.bg,
          color: style.color,
          padding: "0.05em 0.25em",
          borderRadius: "3px",
        }}
      >
        {content}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function NewsSummary({ summary, sentimentScore, sentimentLabel, periodStart, articleCount }: NewsSummaryProps) {
  if (!summary) return null;

  const sentimentColors: Record<string, string> = {
    very_bullish: "text-bullish",
    bullish: "text-bullish",
    neutral: "text-neutral-accent",
    bearish: "text-bearish",
    very_bearish: "text-bearish",
  };

  const sentimentLabels: Record<string, string> = {
    very_bullish: "Strongly Bullish",
    bullish: "Bullish",
    neutral: "Neutral",
    bearish: "Bearish",
    very_bearish: "Strongly Bearish",
  };

  const colorClass = sentimentColors[sentimentLabel || "neutral"] || "text-neutral-accent";
  const displayScore = sentimentScore !== null
    ? (sentimentScore > 0 ? `+${sentimentScore.toFixed(2)}` : sentimentScore.toFixed(2))
    : null;

  // Strip markup tags to get plain text for the drop cap
  const stripped = summary.replace(/\[(name|ticker|price|pct|date)\](.*?)\[\/\1\]/g, "$2");
  const firstLetter = stripped.charAt(0);
  // Remove the first plain-text character from the raw summary (may be inside or outside a tag)
  const tagAtStart = summary.match(/^\[(?:name|ticker|price|pct|date)\]/);
  let restOfSummary: string;
  if (tagAtStart) {
    // First char is inside a tag — remove it from inside the tag content
    const afterOpen = summary.slice(tagAtStart[0].length);
    restOfSummary = tagAtStart[0] + afterOpen.slice(1);
  } else {
    restOfSummary = summary.slice(1);
  }

  return (
    <div className="rounded-lg border border-border bg-surface-card p-6 sm:p-8">
      <p
        className="text-lg sm:text-xl leading-relaxed text-text/90 tracking-[0.01em]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <span
          className="float-left text-[3.2em] font-semibold leading-none mr-2 text-primary overflow-hidden"
          style={{ fontFamily: "var(--font-serif)", height: "2.05lh" }}
        >
          {firstLetter}
        </span>
        {highlightText(restOfSummary)}
      </p>
      <div className="clear-both flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-border text-xs text-text-dim">
        <span>{formatPeriod(periodStart)}</span>
        {articleCount && <span>{articleCount} articles</span>}
        {displayScore && (
          <span className={`font-mono ${colorClass}`}>
            {sentimentLabels[sentimentLabel || "neutral"]} ({displayScore})
          </span>
        )}
      </div>
    </div>
  );
}
