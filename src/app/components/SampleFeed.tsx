"use client";

import { useState } from "react";

interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceSlug: string;
  publishedAt: string | Date;
  summary: string | null;
  category: string;
  sentimentScore: number | null;
  sentimentLabel: string | null;
}

function SentimentBadge({ score, label }: { score: number | null; label: string | null }) {
  if (score === null) return null;

  const colors: Record<string, string> = {
    very_bullish: "text-bullish border-bullish/30 bg-bullish/10",
    bullish: "text-bullish border-bullish/20 bg-bullish/5",
    neutral: "text-neutral-accent border-neutral-accent/20 bg-neutral-accent/5",
    bearish: "text-bearish border-bearish/20 bg-bearish/5",
    very_bearish: "text-bearish border-bearish/30 bg-bearish/10",
  };

  const colorClass = colors[label || "neutral"] || colors.neutral;
  const displayScore = score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${colorClass}`}>
      {displayScore}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border border-primary/20 bg-primary/5 text-primary">
      {category}
    </span>
  );
}

function timeAgo(dateStr: string | Date): string {
  const now = new Date();
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SampleFeed({ articles }: { articles: Article[] }) {
  const [showJson, setShowJson] = useState(false);

  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-card p-8 text-center">
        <p className="text-text-muted">No articles available yet. Run a harvest first.</p>
        <p className="text-xs text-text-dim mt-2 font-mono">POST /api/harvest</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowJson(false)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            !showJson
              ? "bg-primary text-white"
              : "bg-surface-card border border-border text-text-muted hover:text-text"
          }`}
        >
          Cards
        </button>
        <button
          onClick={() => setShowJson(true)}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            showJson
              ? "bg-primary text-white"
              : "bg-surface-card border border-border text-text-muted hover:text-text"
          }`}
        >
          JSON
        </button>
      </div>

      {showJson ? (
        <div className="rounded-lg border border-border bg-surface-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-light">
            <span className="text-xs text-text-dim font-mono">GET /api/feed</span>
            <span className="text-xs text-text-dim">application/json</span>
          </div>
          <pre className="p-4 text-xs font-mono text-text-muted overflow-x-auto leading-relaxed max-h-96 overflow-y-auto">
            {JSON.stringify({ articles, meta: { total: articles.length, page: 1, limit: 10, authenticated: false } }, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener"
              className="block rounded-lg border border-border bg-surface-card p-4 hover:border-border-light hover:bg-surface-hover transition-all duration-200 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium group-hover:text-primary transition-colors leading-snug">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-text-dim">{article.source}</span>
                    <span className="text-xs text-text-dim">{timeAgo(article.publishedAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <CategoryBadge category={article.category} />
                  <SentimentBadge score={article.sentimentScore} label={article.sentimentLabel} />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
