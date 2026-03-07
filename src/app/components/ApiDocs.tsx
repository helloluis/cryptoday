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

      {/* Custom Search Feed */}
      <div className="rounded-lg border border-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-bullish/10 text-bullish border border-bullish/20">
              GET
            </span>
            <span className="text-sm font-mono">/api/feed?scope=custom</span>
            <span className="ml-auto text-xs text-text-dim">API key required</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-text-muted mb-3">
            Returns articles from your registered custom searches only. Results are private to your API key.
          </p>
          <div className="rounded bg-surface-light border border-border p-3">
            <code className="text-xs font-mono text-text-muted whitespace-pre-wrap">{`curl -H "x-api-key: YOUR_KEY" \\
  "https://news.cryptoday.live/api/feed?scope=custom"`}</code>
          </div>
        </div>
      </div>

      {/* Custom Searches CRUD */}
      <div className="rounded-lg border border-border bg-surface-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">Custom Searches</h3>
          <p className="text-xs text-text-dim mt-1">
            Register up to 20 custom search terms per API key. Results are harvested every 4 hours from Google News and GlobeNewsWire.
          </p>
        </div>
        <div className="p-4 space-y-5">
          {/* List */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-bullish/10 text-bullish border border-bullish/20">
                GET
              </span>
              <span className="text-sm font-mono">/api/searches</span>
            </div>
            <p className="text-xs text-text-dim mb-2">List all your registered searches.</p>
            <div className="rounded bg-surface-light border border-border p-3">
              <code className="text-xs font-mono text-text-muted whitespace-pre-wrap">{`curl -H "x-api-key: YOUR_KEY" \\
  https://news.cryptoday.live/api/searches`}</code>
            </div>
          </div>

          {/* Create */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/20">
                POST
              </span>
              <span className="text-sm font-mono">/api/searches</span>
            </div>
            <p className="text-xs text-text-dim mb-2">
              Register a new search term. Google News queries support Boolean operators (<code className="text-xs font-mono bg-surface-light px-1 py-0.5 rounded border border-border">AND</code>, <code className="text-xs font-mono bg-surface-light px-1 py-0.5 rounded border border-border">OR</code>, quotes, parentheses).
            </p>
            <div className="rounded bg-surface-light border border-border p-3 mb-2">
              <code className="text-xs font-mono text-text-muted whitespace-pre-wrap">{`curl -X POST -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "solana AND defi", "provider": "google"}' \\
  https://news.cryptoday.live/api/searches`}</code>
            </div>
            <div className="grid gap-1.5">
              <h4 className="text-xs font-semibold text-text-dim uppercase tracking-wider">Body Fields</h4>
              {[
                { param: "query", desc: "Search term (required, max 200 chars)" },
                { param: "provider", desc: '"google", "gnw", or "both" (default: "google")' },
              ].map((p) => (
                <div key={p.param} className="flex items-baseline gap-3">
                  <code className="text-xs font-mono text-primary shrink-0">{p.param}</code>
                  <span className="text-xs text-text-dim">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Update */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20">
                PATCH
              </span>
              <span className="text-sm font-mono">/api/searches</span>
            </div>
            <p className="text-xs text-text-dim mb-2">
              Update a search&apos;s query, provider, or active status.
            </p>
            <div className="rounded bg-surface-light border border-border p-3 mb-2">
              <code className="text-xs font-mono text-text-muted whitespace-pre-wrap">{`curl -X PATCH -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "search-uuid", "active": false}' \\
  https://news.cryptoday.live/api/searches`}</code>
            </div>
            <div className="grid gap-1.5">
              <h4 className="text-xs font-semibold text-text-dim uppercase tracking-wider">Body Fields</h4>
              {[
                { param: "id", desc: "Search ID (required)" },
                { param: "query", desc: "New search term (optional)" },
                { param: "provider", desc: 'New provider (optional)' },
                { param: "active", desc: "true/false to enable/disable (optional)" },
              ].map((p) => (
                <div key={p.param} className="flex items-baseline gap-3">
                  <code className="text-xs font-mono text-primary shrink-0">{p.param}</code>
                  <span className="text-xs text-text-dim">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Delete */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-bearish/10 text-bearish border border-bearish/20">
                DELETE
              </span>
              <span className="text-sm font-mono">/api/searches</span>
            </div>
            <p className="text-xs text-text-dim mb-2">
              Remove a registered search.
            </p>
            <div className="rounded bg-surface-light border border-border p-3">
              <code className="text-xs font-mono text-text-muted whitespace-pre-wrap">{`curl -X DELETE -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"id": "search-uuid"}' \\
  https://news.cryptoday.live/api/searches`}</code>
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
