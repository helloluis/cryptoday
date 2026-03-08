"use client";

import { useState, useCallback, useEffect, useRef } from "react";

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

const PAGE_SIZE = 20;
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Brand logo mapping: keyword/ticker patterns → SVG filename in /logos/
const BRAND_LOGOS: [RegExp, string][] = [
  // Top tokens
  [/\b(bitcoin|btc)\b/i, "bitcoin-btc-logo.svg"],
  [/\b(ethereum|eth)\b/i, "ethereum-eth-logo.svg"],
  [/\b(solana|sol)\b/i, "solana-sol-logo.svg"],
  [/\b(xrp|ripple)\b/i, "xrp-xrp-logo.svg"],
  [/\b(cardano|ada)\b/i, "cardano-ada-logo.svg"],
  [/\b(bnb)\b/i, "bnb-bnb-logo.svg"],
  [/\b(dogecoin|doge)\b/i, "dogecoin-doge-logo.svg"],
  [/\b(polkadot|dot)\b/i, "polkadot-new-dot-logo.svg"],
  [/\b(avalanche|avax)\b/i, "avalanche-avax-logo.svg"],
  [/\b(chainlink|link)\b/i, "chainlink-link-logo.svg"],
  [/\b(uniswap|uni)\b/i, "uniswap-uni-logo.svg"],
  [/\b(polygon|matic)\b/i, "polygon-matic-logo.svg"],
  [/\b(tether|usdt)\b/i, "tether-usdt-logo.svg"],
  [/\b(usdc|usd coin)\b/i, "usd-coin-usdc-logo.svg"],
  [/\b(litecoin|ltc)\b/i, "litecoin-ltc-logo.svg"],
  [/\b(tron|trx)\b/i, "tron-trx-logo.svg"],
  [/\b(aave)\b/i, "aave-aave-logo.svg"],
  [/\b(near protocol|near)\b/i, "near-protocol-near-logo.svg"],
  [/\b(sui)\b/i, "sui-sui-logo.svg"],
  // Additional tokens
  [/\b(stellar|xlm)\b/i, "stellar-xlm-logo.svg"],
  [/\b(cosmos|atom)\b/i, "cosmos-atom-logo.svg"],
  [/\b(monero|xmr)\b/i, "monero-xmr-logo.svg"],
  [/\b(aptos|apt)\b/i, "aptos-apt-logo.svg"],
  [/\b(arbitrum|arb)\b/i, "arbitrum-arb-logo.svg"],
  [/\b(optimism)\b/i, "optimism-op-logo.svg"],
  [/\b(filecoin|fil)\b/i, "filecoin-fil-logo.svg"],
  [/\b(hedera|hbar)\b/i, "hedera-hbar-logo.svg"],
  [/\b(injective|inj)\b/i, "injective-inj-logo.svg"],
  [/\b(algorand|algo)\b/i, "algorand-algo-logo.svg"],
  [/\b(internet computer|icp)\b/i, "internet-computer-icp-logo.svg"],
  [/\b(vechain|vet)\b/i, "vechain-vet-logo.svg"],
  [/\b(kaspa|kas)\b/i, "kaspa-kas-logo.svg"],
  [/\b(maker|mkr)\b/i, "maker-mkr-logo.svg"],
  [/\b(theta)\b/i, "theta-theta-logo.svg"],
  [/\b(mantle|mnt)\b/i, "mantle-mnt-logo.svg"],
  [/\b(sei)\b/i, "sei-sei-logo.svg"],
  [/\b(worldcoin|wld)\b/i, "worldcoin-wld-logo.svg"],
  [/\b(stacks|stx)\b/i, "stacks-stx-logo.svg"],
  [/\b(celestia|tia)\b/i, "celestia-tia-logo.svg"],
  [/\b(lido)\b/i, "lido-dao-ldo-logo.svg"],
  [/\b(ondo)\b/i, "ondo-ondo-logo.svg"],
  [/\b(pepe)\b/i, "pepe-pepe-logo.svg"],
  [/\b(the graph|grt)\b/i, "the-graph-grt-logo.svg"],
  [/\b(fetch\.ai|fet)\b/i, "fetch-ai-fet-logo.svg"],
  [/\b(shiba inu|shib)\b/i, "shiba-inu-shib-logo.svg"],
  [/\b(toncoin|ton)\b/i, "toncoin-ton-logo.svg"],
  // Exchanges & companies
  [/\b(coinbase)\b/i, "coinbase-logo.svg"],
  [/\b(binance)\b/i, "binance-logo.svg"],
  [/\b(opensea)\b/i, "opensea-logo.svg"],
  [/\b(okx)\b/i, "okx-logo.svg"],
  [/\b(kucoin)\b/i, "kucoin-logo.svg"],
  [/\b(robinhood)\b/i, "robinhood-logo.svg"],
  [/\b(circle)\b/i, "circle-logo.svg"],
  [/\b(blockchain\.com)\b/i, "blockchaindotcom-logo.svg"],
  [/\b(paypal)\b/i, "paypal-logo.svg"],
  [/\b(stripe)\b/i, "stripe-logo.svg"],
  [/\b(revolut)\b/i, "revolut-logo.svg"],
  [/\b(uphold)\b/i, "uphold-logo.svg"],
];

// Also match by article category
const CATEGORY_LOGOS: Record<string, string> = {
  BTC: "bitcoin-btc-logo.svg",
  ETH: "ethereum-eth-logo.svg",
  SOL: "solana-sol-logo.svg",
  XRP: "xrp-xrp-logo.svg",
  ADA: "cardano-ada-logo.svg",
  BNB: "bnb-bnb-logo.svg",
  DOGE: "dogecoin-doge-logo.svg",
  DOT: "polkadot-new-dot-logo.svg",
  AVAX: "avalanche-avax-logo.svg",
  LINK: "chainlink-link-logo.svg",
  UNI: "uniswap-uni-logo.svg",
  MATIC: "polygon-matic-logo.svg",
  LTC: "litecoin-ltc-logo.svg",
  TRX: "tron-trx-logo.svg",
  NEAR: "near-protocol-near-logo.svg",
  SUI: "sui-sui-logo.svg",
  XLM: "stellar-xlm-logo.svg",
  ATOM: "cosmos-atom-logo.svg",
  XMR: "monero-xmr-logo.svg",
  APT: "aptos-apt-logo.svg",
  ARB: "arbitrum-arb-logo.svg",
  OP: "optimism-op-logo.svg",
  FIL: "filecoin-fil-logo.svg",
  HBAR: "hedera-hbar-logo.svg",
  INJ: "injective-inj-logo.svg",
  ALGO: "algorand-algo-logo.svg",
  ICP: "internet-computer-icp-logo.svg",
  VET: "vechain-vet-logo.svg",
  KAS: "kaspa-kas-logo.svg",
  MKR: "maker-mkr-logo.svg",
  THETA: "theta-theta-logo.svg",
  MNT: "mantle-mnt-logo.svg",
  SEI: "sei-sei-logo.svg",
  WLD: "worldcoin-wld-logo.svg",
  STX: "stacks-stx-logo.svg",
  TIA: "celestia-tia-logo.svg",
  LDO: "lido-dao-ldo-logo.svg",
  ONDO: "ondo-ondo-logo.svg",
  PEPE: "pepe-pepe-logo.svg",
  GRT: "the-graph-grt-logo.svg",
  FET: "fetch-ai-fet-logo.svg",
  SHIB: "shiba-inu-shib-logo.svg",
  TON: "toncoin-ton-logo.svg",
};

interface DynamicLogo {
  brand: string;
  keywords: string[];
  filename: string;
}

// People/faces get circular crop treatment
const PERSON_LOGOS: [RegExp, string][] = [
  [/\b(trump)\b/i, "trump.jpg"],
  [/\b(elon musk|musk)\b/i, "elon-musk.jpg"],
  [/\b(jack dorsey|dorsey)\b/i, "jack-dorsey.jpg"],
  [/\b(michael saylor|saylor)\b/i, "michael-saylor.png"],
  [/\b(vitalik buterin|vitalik)\b/i, "vitalik-buterin.jpg"],
  [/\b(sam bankman|sbf)\b/i, "sbf.png"],
  [/\b(changpeng zhao|cz)\b/i, "cz.jpg"],
  [/\b(gary gensler|gensler)\b/i, "gary-gensler.jpg"],
  [/\b(cathie wood)\b/i, "cathie-wood.jpg"],
  [/\b(brian armstrong)\b/i, "brian-armstrong.jpg"],
];

// Country/region flags matched by keyword in title
const COUNTRY_FLAGS: [RegExp, string][] = [
  [/\bkazakhstan\b/i, "🇰🇿"],
  [/\b(united states|u\.s\.|us congress|sec |irs |american)\b/i, "🇺🇸"],
  [/\bflorida\b/i, "🇺🇸"],
  [/\b(china|chinese|beijing)\b/i, "🇨🇳"],
  [/\b(japan|japanese|tokyo)\b/i, "🇯🇵"],
  [/\b(south korea|korean|seoul)\b/i, "🇰🇷"],
  [/\b(india|indian|mumbai)\b/i, "🇮🇳"],
  [/\b(uk|britain|british|london)\b/i, "🇬🇧"],
  [/\b(eu|europe|european|brussels)\b/i, "🇪🇺"],
  [/\b(russia|russian|moscow)\b/i, "🇷🇺"],
  [/\b(brazil|brazilian)\b/i, "🇧🇷"],
  [/\b(canada|canadian)\b/i, "🇨🇦"],
  [/\b(australia|australian)\b/i, "🇦🇺"],
  [/\b(singapore|singaporean)\b/i, "🇸🇬"],
  [/\b(hong kong)\b/i, "🇭🇰"],
  [/\b(uae|dubai|abu dhabi|emirates)\b/i, "🇦🇪"],
  [/\b(nigeria|nigerian)\b/i, "🇳🇬"],
  [/\b(el salvador|salvadoran)\b/i, "🇸🇻"],
  [/\b(philippines|filipino|coins\.ph)\b/i, "🇵🇭"],
  [/\b(latin america)\b/i, "🌎"],
  [/\b(germany|german|berlin)\b/i, "🇩🇪"],
  [/\b(switzerland|swiss)\b/i, "🇨🇭"],
  [/\b(iran|iranian|tehran)\b/i, "🇮🇷"],
  [/\b(israel|israeli)\b/i, "🇮🇱"],
  [/\b(indonesia|indonesian)\b/i, "🇮🇩"],
  [/\b(turkey|turkish|ankara)\b/i, "🇹🇷"],
  [/\b(south africa|south african)\b/i, "🇿🇦"],
  [/\b(argentina|argentinian)\b/i, "🇦🇷"],
  [/\b(mexico|mexican)\b/i, "🇲🇽"],
];

interface LogoMatch {
  src: string;
  circular: boolean;
  emoji?: string; // for flag/emoji thumbnails
}

function getLogoForArticle(article: Article, dynamicLogos: DynamicLogo[] = []): LogoMatch | null {
  const text = article.title;

  // First try person match (circular photo)
  for (const [pattern, file] of PERSON_LOGOS) {
    if (pattern.test(text)) return { src: `/faces/${file}`, circular: true };
  }

  // Then try category match (token logo)
  const catLogo = CATEGORY_LOGOS[article.category];
  if (catLogo) return { src: `/logos/${catLogo}`, circular: false };

  // Then try title keyword match (hardcoded brand logos)
  for (const [pattern, file] of BRAND_LOGOS) {
    if (pattern.test(text)) return { src: `/logos/${file}`, circular: false };
  }

  // Then try auto-discovered logos from DB
  const titleLower = text.toLowerCase();
  for (const logo of dynamicLogos) {
    for (const kw of logo.keywords) {
      if (titleLower.includes(kw.toLowerCase())) return { src: `/logos/${logo.filename}`, circular: false };
    }
  }

  // Finally try country flag
  for (const [pattern, emoji] of COUNTRY_FLAGS) {
    if (pattern.test(text)) return { src: "", circular: false, emoji };
  }

  return null;
}

function formatFullDate(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
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

function ArticleCard({ article, dynamicLogos }: { article: Article; dynamicLogos: DynamicLogo[] }) {
  const logo = getLogoForArticle(article, dynamicLogos);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener"
      className="block rounded-lg border border-border bg-surface-card hover:border-border-light hover:bg-surface-hover transition-all duration-200 group"
    >
      <div className="flex items-stretch">
        {logo && (
          <div className="w-14 shrink-0 flex items-center justify-center px-3">
            {logo.emoji ? (
              <span className="text-2xl leading-none crypto-logo-mono">{logo.emoji}</span>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logo.src}
                alt=""
                className={`w-8 h-8 ${logo.circular ? "rounded-full object-cover" : "object-contain"} crypto-logo-mono`}
              />
            )}
          </div>
        )}
        <div className={`flex-1 min-w-0 p-4 ${logo ? "pl-0" : ""}`}>
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
                <span
                  className="text-xs text-text-dim cursor-default"
                  title={formatFullDate(article.publishedAt)}
                >
                  {timeAgo(article.publishedAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <CategoryBadge category={article.category} />
              <SentimentBadge score={article.sentimentScore} label={article.sentimentLabel} />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

export function SampleFeed({ articles: initialArticles, dynamicLogos = [] }: { articles: Article[]; dynamicLogos?: DynamicLogo[] }) {
  const [showJson, setShowJson] = useState(false);
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialArticles.length >= PAGE_SIZE);
  const knownIds = useRef(new Set(initialArticles.map((a) => a.id)));

  // Auto-refresh every 15 minutes — prepend new articles
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/feed?limit=${PAGE_SIZE}`);
        const data = await res.json();
        const fresh: Article[] = data.articles || [];
        const newOnes = fresh.filter((a) => !knownIds.current.has(a.id));
        if (newOnes.length > 0) {
          for (const a of newOnes) knownIds.current.add(a.id);
          setArticles((prev) => [...newOnes, ...prev]);
        }
      } catch {
        // silent
      }
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const skip = articles.length;
      const res = await fetch(`/api/feed?skip=${skip}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      const newArticles: Article[] = (data.articles || []).filter(
        (a: Article) => !knownIds.current.has(a.id)
      );
      for (const a of newArticles) knownIds.current.add(a.id);
      setArticles((prev) => [...prev, ...newArticles]);
      if (newArticles.length < PAGE_SIZE) setHasMore(false);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [articles.length]);

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
      <div className="flex justify-end gap-1 mb-4">
        <button
          onClick={() => setShowJson(false)}
          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
            !showJson
              ? "bg-primary text-white"
              : "bg-surface-card border border-border text-text-dim hover:text-text"
          }`}
        >
          Cards
        </button>
        <button
          onClick={() => setShowJson(true)}
          className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
            showJson
              ? "bg-primary text-white"
              : "bg-surface-card border border-border text-text-dim hover:text-text"
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
            {JSON.stringify({ articles, meta: { total: articles.length, page: 1, limit: PAGE_SIZE, authenticated: false } }, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} dynamicLogos={dynamicLogos} />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="w-full py-3 rounded-lg border border-border bg-surface-card text-sm text-text-muted hover:border-border-light hover:bg-surface-hover transition-all duration-200 disabled:opacity-50"
            >
              {loading ? "Loading..." : "More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
