export function ApiDocs() {
  return (
    <div className="space-y-4">
      {/* Free Feed */}
      <div className="rounded-lg border border-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-bullish/10 text-bullish border border-bullish/20">
              GET
            </span>
            <span className="text-sm font-mono">/api/feed</span>
            <span className="ml-auto text-xs text-text-dim">No auth required</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-text-muted mb-3">
            Returns the 10 most recent analyzed articles. Free and unauthenticated.
          </p>
          <div className="rounded bg-surface-light border border-border p-3">
            <code className="text-xs font-mono text-text-muted">
              curl https://news.cryptoday.live/api/feed
            </code>
          </div>
        </div>
      </div>

      {/* Authenticated Feed */}
      <div className="rounded-lg border border-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-bullish/10 text-bullish border border-bullish/20">
              GET
            </span>
            <span className="text-sm font-mono">/api/feed</span>
            <span className="ml-auto text-xs text-text-dim">API key required</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-text-muted mb-3">
            Full paginated feed with filtering. Pass your API key via the{" "}
            <code className="text-xs font-mono bg-surface-light px-1.5 py-0.5 rounded border border-border">
              x-api-key
            </code>{" "}
            header.
          </p>
          <div className="rounded bg-surface-light border border-border p-3 mb-3">
            <code className="text-xs font-mono text-text-muted whitespace-pre-wrap">{`curl -H "x-api-key: YOUR_KEY" \\
  "https://news.cryptoday.live/api/feed?category=BTC&page=1"`}</code>
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-dim uppercase tracking-wider">Query Parameters</h4>
            <div className="grid gap-1.5">
              {[
                { param: "category", desc: "Filter by category (BTC, ETH, SOL, ALL, DEFI, NFT, REG, ...)" },
                { param: "source", desc: "Filter by source slug (coindesk, cointelegraph, decrypt, ...)" },
                { param: "page", desc: "Page number for pagination (default: 1)" },
              ].map((p) => (
                <div key={p.param} className="flex items-baseline gap-3">
                  <code className="text-xs font-mono text-primary shrink-0">{p.param}</code>
                  <span className="text-xs text-text-dim">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Response Format */}
      <div className="rounded-lg border border-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">Response Format</h3>
        </div>
        <div className="p-4">
          <pre className="text-xs font-mono text-text-muted leading-relaxed overflow-x-auto">{`{
  "articles": [
    {
      "id": "uuid",
      "title": "Article title",
      "url": "https://...",
      "source": "CoinDesk",
      "sourceSlug": "coindesk",
      "publishedAt": "2026-03-06T12:00:00.000Z",
      "summary": "AI-generated 1-2 sentence summary",
      "category": "BTC",
      "sentimentScore": 0.65,
      "sentimentLabel": "bullish"
    }
  ],
  "meta": {
    "total": 1234,
    "page": 1,
    "limit": 50,
    "authenticated": true
  }
}`}</pre>
        </div>
      </div>
    </div>
  );
}
