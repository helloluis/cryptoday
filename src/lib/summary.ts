import OpenAI from "openai";
import { prisma } from "./db";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

/** Get the start of the current 4-hour period (00, 04, 08, 12, 16, 20 UTC) */
export function getCurrentPeriodStart(): Date {
  const now = new Date();
  const hour = Math.floor(now.getUTCHours() / 4) * 4;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0));
}

/** Get the most recent completed 4-hour period */
export function getLastCompletedPeriod(): { start: Date; end: Date } {
  const currentStart = getCurrentPeriodStart();
  const end = currentStart;
  const start = new Date(currentStart.getTime() - 4 * 60 * 60 * 1000);
  return { start, end };
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
    select: { title: true, summary: true, source: true, category: true, sentimentScore: true },
  });
  let periodStart = currentStart;
  let periodEnd = currentEnd;

  if (articles.length < 3) {
    // Fall back to last completed period
    articles = await prisma.article.findMany({
      where: {
        analyzed: true,
        hidden: false,
        publishedAt: { gte: lastStart, lt: lastEnd },
      },
      orderBy: { publishedAt: "desc" },
      select: { title: true, summary: true, source: true, category: true, sentimentScore: true },
    });
    periodStart = lastStart;
    periodEnd = lastEnd;
  }

  // If still not enough, grab the most recent articles regardless of period
  if (articles.length < 3) {
    articles = await prisma.article.findMany({
      where: { analyzed: true, hidden: false },
      orderBy: { publishedAt: "desc" },
      take: 30,
      select: { title: true, summary: true, source: true, category: true, sentimentScore: true },
    });
    if (articles.length === 0) return null;
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

  const avgSentiment = articles.reduce((sum, a) => sum + (a.sentimentScore || 0), 0) / articles.length;

  const response = await client.chat.completions.create({
    model: "qwen3.5-plus",
    messages: [
      {
        role: "system",
        content: `You are a senior crypto market analyst writing a brief news digest. Given a list of recent crypto news items, write exactly 5 sentences that capture the most significant events and themes. Focus on topics covered by multiple publications. Write in a professional, informative tone — not hype. Do not use bullet points. Write as a single flowing paragraph. Always use Oxford commas (e.g. "Bitcoin, Ethereum, and Solana" not "Bitcoin, Ethereum and Solana").

Items tagged [ARTICLE] are from professional news outlets and should be your primary source of information. Items tagged [TWEET] are from social media and have a lower standard of accuracy — use them only as supporting color or to note community sentiment, never as the sole basis for a claim.

IMPORTANT: In your summary, wrap key entities in markup tags for highlighting:
- [name]Person or Company Name[/name] for people, companies, organizations, and exchanges
- [ticker]BTC[/ticker] for crypto tickers and asset names
- [price]$1,234[/price] for dollar amounts, prices, and valuations (include "billion", "million" etc.)
- [pct]5.2%[/pct] for percentages
- [date]March 5[/date] for dates

Example: "[name]BlackRock[/name] filed for a [ticker]BTC[/ticker] spot ETF, pushing the price above [price]$70,000[/price] — a [pct]12%[/pct] gain since [date]January 15[/date]."

Respond with ONLY valid JSON (no markdown, no code fences):
{"summary":"Your 5-sentence paragraph with markup tags","sentimentScore":0.0,"sentimentLabel":"label"}

sentimentScore: -1.0 (very bearish) to 1.0 (very bullish) reflecting the overall mood of this batch of news.
sentimentLabel: one of "very_bearish", "bearish", "neutral", "bullish", "very_bullish"`,
      },
      {
        role: "user",
        content: digest,
      },
    ],
    temperature: 0.4,
    max_tokens: 500,
    // @ts-expect-error — DashScope extension to disable Qwen thinking mode
    enable_thinking: false,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();

  let summaryText: string;
  let sentimentScore: number;
  let sentimentLabel: string;

  try {
    const parsed = JSON.parse(cleaned);
    summaryText = parsed.summary || "Summary unavailable.";
    sentimentScore = typeof parsed.sentimentScore === "number" ? parsed.sentimentScore : avgSentiment;
    sentimentLabel = parsed.sentimentLabel || "neutral";
  } catch {
    console.error("[Summary] Failed to parse:", raw);
    summaryText = "Summary generation failed.";
    sentimentScore = avgSentiment;
    sentimentLabel = avgSentiment > 0.3 ? "bullish" : avgSentiment < -0.3 ? "bearish" : "neutral";
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
