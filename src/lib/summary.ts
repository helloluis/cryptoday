import OpenAI from "openai";
import { prisma } from "./db";
import { recordUsage } from "./usage";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.VULTR_INFERENCE_API_KEY,
      baseURL: "https://api.vultrinference.com/v1",
    });
  }
  return _client;
}

/** Get the start of the current 4-hour period (00, 04, 08, 12, 16, 20 UTC) */
export function getCurrentPeriodStart(): Date {
  const now = new Date();
  const hour = Math.floor(now.getUTCHours() / 4) * 4;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      0,
      0,
      0,
    ),
  );
}

/** Get the most recent completed 4-hour period */
export function getLastCompletedPeriod(): { start: Date; end: Date } {
  const currentStart = getCurrentPeriodStart();
  const end = currentStart;
  const start = new Date(currentStart.getTime() - 4 * 60 * 60 * 1000);
  return { start, end };
}

type DigestArticle = {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  category: string;
  sentimentScore: number | null;
};

/**
 * Guarantee PH politics/regulation and AI stories are represented in the digest
 * input, even when higher-volume crypto news would crowd them out.
 */
async function withPolicyCoverage(
  articles: DigestArticle[],
  start: Date,
  end: Date,
): Promise<DigestArticle[]> {
  const policyArticles = await prisma.article.findMany({
    where: {
      analyzed: true,
      hidden: false,
      publishedAt: { gte: start, lt: end },
      category: { in: ["PH", "REG", "AI"] },
    },
    orderBy: { publishedAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      summary: true,
      source: true,
      category: true,
      sentimentScore: true,
    },
  });

  const seen = new Set(articles.map((a) => a.id));
  return [
    ...articles.slice(0, 30),
    ...policyArticles.filter((a) => !seen.has(a.id)),
  ];
}

export async function getOrCreateSummary(): Promise<{
  summary: string;
  sentimentScore: number;
  sentimentLabel: string;
  periodStart: Date;
  periodEnd: Date;
  articleCount: number;
} | null> {
  // Try the current period first (if articles exist), then fall back to last completed
  const currentStart = getCurrentPeriodStart();
  const currentEnd = new Date(currentStart.getTime() + 4 * 60 * 60 * 1000);

  // Check if we already have a cached summary for the current period
  let cached = await prisma.newsSummary.findUnique({
    where: { periodStart: currentStart },
  });
  if (cached) return cached;

  // Try last completed period
  const { start: lastStart, end: lastEnd } = getLastCompletedPeriod();
  cached = await prisma.newsSummary.findUnique({
    where: { periodStart: lastStart },
  });
  if (cached) return cached;

  // Generate for whichever period has articles
  // First try current period
  let articles = await prisma.article.findMany({
    where: {
      analyzed: true,
      hidden: false,
      publishedAt: { gte: currentStart, lt: currentEnd },
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      summary: true,
      source: true,
      category: true,
      sentimentScore: true,
    },
  });
  let periodStart = currentStart;
  let periodEnd = currentEnd;
  articles = await withPolicyCoverage(articles, currentStart, currentEnd);

  if (articles.length < 3) {
    // Fall back to last completed period
    articles = await prisma.article.findMany({
      where: {
        analyzed: true,
        hidden: false,
        publishedAt: { gte: lastStart, lt: lastEnd },
      },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        summary: true,
        source: true,
        category: true,
        sentimentScore: true,
      },
    });
    periodStart = lastStart;
    periodEnd = lastEnd;
    articles = await withPolicyCoverage(articles, lastStart, lastEnd);
  }

  // If still not enough, grab the most recent articles regardless of period
  if (articles.length < 3) {
    articles = await prisma.article.findMany({
      where: { analyzed: true, hidden: false },
      orderBy: { publishedAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        summary: true,
        source: true,
        category: true,
        sentimentScore: true,
      },
    });
    if (articles.length === 0) return null;
    // No meaningful period — cover the last 3 days for policy stories
    articles = await withPolicyCoverage(
      articles,
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      new Date(),
    );
  }

  // Build the article digest for the AI — label tweets separately
  const digest = articles
    .slice(0, 40)
    .map((a, i) => {
      const isTwitter = a.source.startsWith("X (");
      const tag = isTwitter ? "TWEET" : "ARTICLE";
      return `${i + 1}. [${tag}][${a.source}] ${a.title}${a.summary ? ` — ${a.summary}` : ""}`;
    })
    .join("\n");

  const avgSentiment =
    articles.reduce((sum, a) => sum + (a.sentimentScore || 0), 0) /
    articles.length;

  const response = await getClient().chat.completions.create({
    model: "MiniMaxAI/MiniMax-M2.7",
    messages: [
      {
        role: "system",
        content: `You are a senior news editor writing a brief news digest for a Philippines-based digital assets and technology news service. Given a list of recent news items, write exactly 6 sentences that capture the most significant events and themes across crypto markets, artificial intelligence, macroeconomics, and Philippine politics, policy, and regulation. Focus on topics covered by multiple publications. Write in a professional, informative tone — not hype. Do not use bullet points. Write as a single flowing paragraph. Always use Oxford commas (e.g. "Bitcoin, Ethereum, and Solana" not "Bitcoin, Ethereum and Solana").

If the list contains items about Philippine politics, government, or regulation (e.g. PCO releases, BSP/SEC/DICT memorandums, legislation), at least one sentence MUST cover the most significant Philippine development.

Items tagged [ARTICLE] are from professional news outlets and should be your primary source of information. Items tagged [TWEET] are from social media and have a lower standard of accuracy — use them only as supporting color or to note community sentiment, never as the sole basis for a claim.

IMPORTANT: In your summary, wrap key entities in markup tags for highlighting:
- [name]Person or Organization[/name] for people (including politicians and government officials), companies, government agencies and institutions (e.g. Bangko Sentral ng Pilipinas, SEC), and exchanges
- [ticker]BTC[/ticker] for crypto tickers and asset names
- [price]$1,234[/price] for prices, amounts, and valuations in any currency (dollars, pesos, etc. — include "billion", "million" etc.)
- [pct]5.2%[/pct] for percentages
- [date]March 5[/date] for dates

Tag every significant proper noun — do not leave prominent people, agencies, or institutions untagged.

Examples: "[name]BlackRock[/name] filed for a [ticker]BTC[/ticker] spot ETF, pushing the price above [price]$70,000[/price] — a [pct]12%[/pct] gain since [date]January 15[/date]."
"[name]President Marcos[/name] signed the measure as [name]Bangko Sentral ng Pilipinas[/name] held rates steady, while [name]Sara Duterte[/name] criticized the [price]₱85[/price] wage hike."

Respond with ONLY valid JSON (no markdown, no code fences):
{"summary":"Your 6-sentence paragraph with markup tags","sentimentScore":0.0,"sentimentLabel":"label"}

sentimentScore: -1.0 (very bearish) to 1.0 (very bullish) reflecting the overall mood of this batch of news.
sentimentLabel: one of "very_bearish", "bearish", "neutral", "bullish", "very_bullish"`,
      },
      {
        role: "user",
        content: digest,
      },
    ],
    temperature: 0.4,
    max_tokens: 4000,
  });

  await recordUsage("digest", response.model, response.usage);

  const raw = response.choices[0]?.message?.content?.trim() || "";
  // Strip <think> blocks (with or without closing tag)
  const cleaned = raw
    .replace(/<think>[\s\S]*?(?:<\/think>|(?=\{|\[)|$)/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let summaryText: string;
  let sentimentScore: number;
  let sentimentLabel: string;

  try {
    const parsed = JSON.parse(cleaned);
    summaryText = parsed.summary || "Summary unavailable.";
    sentimentScore =
      typeof parsed.sentimentScore === "number"
        ? parsed.sentimentScore
        : avgSentiment;
    sentimentLabel = parsed.sentimentLabel || "neutral";
  } catch {
    console.error("[Summary] Failed to parse:", raw);
    summaryText = "Summary generation failed.";
    sentimentScore = avgSentiment;
    sentimentLabel =
      avgSentiment > 0.3
        ? "bullish"
        : avgSentiment < -0.3
          ? "bearish"
          : "neutral";
  }

  // Cache it
  const saved = await prisma.newsSummary.create({
    data: {
      periodStart,
      periodEnd,
      summary: summaryText,
      sentimentScore,
      sentimentLabel,
      articleCount: articles.length,
    },
  });

  return saved;
}
