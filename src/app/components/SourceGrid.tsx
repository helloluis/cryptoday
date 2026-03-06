import type { FeedSource } from "@/lib/sources";

interface SourceGridProps {
  sources: FeedSource[];
}

export function SourceGrid({ sources }: SourceGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {sources.map((source) => (
        <a
          key={source.slug}
          href={`https://${source.website}`}
          target="_blank"
          rel="noopener"
          className="group rounded-lg border border-border bg-surface-card p-4 hover:border-border-light hover:bg-surface-hover transition-all duration-200"
        >
          <p className="text-sm font-medium group-hover:text-primary transition-colors">
            {source.name}
          </p>
          <p className="text-xs text-text-dim mt-1 font-mono">{source.website}</p>
        </a>
      ))}
    </div>
  );
}
