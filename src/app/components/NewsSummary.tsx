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
  return `${dateFmt}, ${fmt(d)}–${fmt(end)} UTC`;
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

  const sentimentIcons: Record<string, string> = {
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

  return (
    <div className="rounded-lg border border-border bg-surface-card p-6">
      <p className="text-base leading-relaxed text-text/90">
        {summary}
      </p>
      <div className="flex items-center gap-4 mt-4 text-xs text-text-dim">
        <span>{formatPeriod(periodStart)}</span>
        {articleCount && <span>{articleCount} articles</span>}
        {displayScore && (
          <span className={`font-mono ${colorClass}`}>
            {sentimentIcons[sentimentLabel || "neutral"]} ({displayScore})
          </span>
        )}
      </div>
    </div>
  );
}
