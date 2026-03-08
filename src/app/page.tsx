import { prisma } from "@/lib/db";
import { SOURCES } from "@/lib/sources";
import { getOrCreateSummary } from "@/lib/summary";
import { SampleFeed } from "./components/SampleFeed";
import { SourceGrid } from "./components/SourceGrid";
import { ApiDocs } from "./components/ApiDocs";
import { Stats } from "./components/Stats";
import { NewsSummary } from "./components/NewsSummary";

async function getStats() {
  try {
    const [totalArticles, totalTweets, latestArticle] = await Promise.all([
      prisma.article.count({ where: { sourceSlug: { not: "x" } } }),
      prisma.article.count({ where: { sourceSlug: "x" } }),
      prisma.article.findFirst({ orderBy: { publishedAt: "desc" }, select: { publishedAt: true } }),
    ]);
    return { totalArticles, totalTweets, lastUpdated: latestArticle?.publishedAt ?? null };
  } catch {
    return { totalArticles: 0, totalTweets: 0, lastUpdated: null };
  }
}

async function getSampleArticles() {
  try {
    return await prisma.article.findMany({
      where: { analyzed: true },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        sourceSlug: true,
        publishedAt: true,
        summary: true,
        category: true,
        sentimentScore: true,
        sentimentLabel: true,
      },
    });
  } catch {
    return [];
  }
}

async function getSummary() {
  try {
    return await getOrCreateSummary();
  } catch {
    return null;
  }
}

export const revalidate = 300;

export default async function HomePage() {
  const [stats, sampleArticles, summary] = await Promise.all([
    getStats(),
    getSampleArticles(),
    getSummary(),
  ]);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-light bg-surface-card text-xs text-text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-bullish animate-pulse-glow" />
              Live Feed
            </div>
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight mb-3"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              <span className="text-primary">CryptoDay</span> News
            </h1>
            <p className="text-xs text-text-dim max-w-2xl leading-relaxed">
              News aggregation and sentiment analysis, harvested and analyzed hourly by{" "}
              <span className="text-text-muted">Qwen 3.5 Plus</span>. Designed by{" "}
              <a
                href="https://x.com/helloluis"
                className="text-primary hover:text-primary-light transition-colors"
                target="_blank"
                rel="noopener"
              >
                @helloluis
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* News Summary */}
      {summary && (
        <section className="max-w-5xl mx-auto px-6 pb-12">
          <div className="animate-fade-in">
            <NewsSummary
              summary={summary.summary}
              sentimentScore={summary.sentimentScore}
              sentimentLabel={summary.sentimentLabel}
              periodStart={summary.periodStart}
              articleCount={summary.articleCount}
            />
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <Stats
          totalArticles={stats.totalArticles}
          totalTweets={stats.totalTweets}
          sourceCount={SOURCES.length}
          lastUpdated={stats.lastUpdated}
        />
      </section>

      {/* Feed */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <SampleFeed articles={sampleArticles} />
      </section>

      {/* Sources */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-text-dim uppercase tracking-wider">
          <span className="w-1 h-4 bg-primary rounded-full" />
          Sources
        </h2>
        <SourceGrid sources={SOURCES} />
      </section>

      {/* API Docs */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span className="w-1 h-5 bg-primary rounded-full" />
          API Access
        </h2>
        <ApiDocs />
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-text-dim">
            Built by{" "}
            <a
              href="https://e3.cryptoday.live"
              className="text-primary hover:text-primary-light transition-colors"
              target="_blank"
              rel="noopener"
            >
              @helloluis
            </a>
          </p>
          <p className="text-xs text-text-dim font-mono">news.cryptoday.live</p>
        </div>
      </footer>
    </main>
  );
}
