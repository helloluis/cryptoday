import type { FeedSource } from "@/lib/sources";

interface SourceGridProps {
  sources: FeedSource[];
}

export function SourceGrid({ sources }: SourceGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <a
          key={source.slug}
          href={`https://${source.website}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-surface-card text-xs hover:border-border-light hover:bg-surface-hover transition-all duration-200 group"
        >
          <span className="font-medium group-hover:text-primary transition-colors">
            {source.name}
          </span>
          <span className="text-text-dim font-mono hidden sm:inline">{source.website}</span>
        </a>
      ))}
    </div>
  );
}
