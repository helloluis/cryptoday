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

function highlightText(text: string): ReactNode[] {
  const pattern = /(\$[\d,.]+(?:\s*(?:billion|million|trillion))?|\d+(?:\.\d+)?%|\b[A-Z]{2,}(?:-[A-Z]+)*\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s*\d{4})?)/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    const isNumber = /^[\$\d]/.test(matched);

    parts.push(
      <span
        key={match.index}
        style={{
          backgroundColor: isNumber
            ? "var(--color-highlight-number)"
            : "var(--color-highlight-letter)",
          color: isNumber
            ? "var(--color-highlight-number-text)"
            : "var(--color-highlight-letter-text)",
          padding: "0.05em 0.25em",
          borderRadius: "3px",
        }}
      >
        {matched}
      </span>
    );

    lastIndex = match.index + matched.length;
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

  const firstLetter = summary.charAt(0);
  const restOfText = summary.slice(1);

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
        {highlightText(restOfText)}
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
