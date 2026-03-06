interface StatsProps {
  totalArticles: number;
  analyzedArticles: number;
  sourceCount: number;
  lastUpdated: Date | null;
}

export function Stats({ totalArticles, analyzedArticles, sourceCount, lastUpdated }: StatsProps) {
  const items = [
    { label: "Sources", value: sourceCount.toString() },
    { label: "Articles", value: totalArticles.toLocaleString() },
    { label: "Analyzed", value: analyzedArticles.toLocaleString() },
    {
      label: "Last Updated",
      value: lastUpdated
        ? new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Singapore",
          }).format(lastUpdated)
        : "—",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-border bg-surface-card p-4"
        >
          <p className="text-xs text-text-dim uppercase tracking-wider mb-1">
            {item.label}
          </p>
          <p className="text-xl font-semibold font-mono">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
