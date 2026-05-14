import OpenAI from "openai";
import { prisma } from "./db";

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

const CRYPTO_TOKENS = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "DOGE",
  "AVAX",
  "DOT",
  "MATIC",
  "LINK",
  "UNI",
  "ATOM",
  "LTC",
  "FIL",
  "APT",
  "ARB",
  "OP",
  "SUI",
  "SEI",
  "NEAR",
  "PEPE",
  "SHIB",
  "TRX",
  "TON",
  "HBAR",
  "ICP",
  "INJ",
  "TIA",
  "JUP",
];

const SYSTEM_PROMPT = `You are a crypto news analyst and curator for an English-language crypto news aggregator based in the Philippines.

You will receive a numbered list of news articles. For EACH article, produce an analysis object. Respond with ONLY a valid JSON array (no markdown, no code fences) — one object per article, in the same order.

Each object must have these fields:
{"id":<number>,"summary":"...","category":"...","sentimentScore":0.0,"sentimentLabel":"...","relevant":true,"hiddenReason":null}

Fields:
- id: the article number from the input (1, 2, 3, etc.)
- summary: concise 1-2 sentence summary of the key takeaway
- category: if primarily about a specific cryptocurrency, use its ticker (${CRYPTO_TOKENS.join(", ")}). General crypto → "ALL". DeFi → "DEFI". NFTs → "NFT". Regulation → "REG".
- sentimentScore: float from -1.0 (very bearish) to 1.0 (very bullish), 0 = neutral
- sentimentLabel: one of "very_bearish", "bearish", "neutral", "bullish", "very_bullish"
- relevant: boolean — should this article appear in our feed?
- hiddenReason: if relevant is false, a short reason why (otherwise null)

Relevance rules (set relevant=false if ANY apply):
1. NOT ENGLISH: The title or body is primarily in a non-English language (Danish, German, French, etc.)
2. IRRELEVANT: The article has zero connection to crypto AND zero macro significance. Corporate share buybacks, traditional stock transactions, small-cap equity filings, and routine corporate press releases should be hidden.
3. TOO REGIONAL: The news is specific to a small regional company or local market with no global significance. Exception: Philippine companies/markets ARE relevant since our audience is Philippines-based. Exception: news about globally recognized companies (Fortune 500, major tech companies, major crypto exchanges) is always relevant regardless of region.
4. PRESS RELEASE SPAM: Generic corporate press releases, share transaction notices, or regulatory filings with no crypto or macro relevance.

IMPORTANT — these topics are ALWAYS relevant even without explicit crypto mentions:
- AI/artificial intelligence (major AI companies, regulation, breakthroughs) — AI and crypto markets are deeply intertwined
- War, geopolitical conflict, sanctions, military escalation — these are macro catalysts that directly move crypto markets
- Major central bank decisions, interest rates, inflation data, monetary policy
- US regulation, SEC/CFTC actions, global financial regulation
- Fortune 500 earnings or moves that signal broader market direction
- Energy markets and oil price shocks (affect mining economics and risk sentiment)

Be generous — when in doubt, mark as relevant. Our readers are crypto-focused but macro-aware. A niche-but-genuine article is better than a false rejection.

Respond with ONLY the JSON array.`;

interface AnalysisResult {
  summary: string;
  category: string;
  sentimentScore: number;
  sentimentLabel: string;
  relevant: boolean;
  hiddenReason: string | null;
}

const DEFAULT_RESULT: AnalysisResult = {
  summary: "Analysis unavailable.",
  category: "ALL",
  sentimentScore: 0,
  sentimentLabel: "neutral",
  relevant: true,
  hiddenReason: null,
};

/** Analyze a single article (used as fallback and by backfillCuration) */
export async function analyzeArticle(
  title: string,
  content: string | null,
): Promise<AnalysisResult> {
  const text = content ? `${title}\n\n${content.slice(0, 1500)}` : title;

  const response = await getClient().chat.completions.create({
    model: "MiniMaxAI/MiniMax-M2.7",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `1. ${text}` },
    ],
    temperature: 0.3,
    max_tokens: 400,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";
  const cleaned = raw
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      summary: item.summary || "No summary available.",
      category: item.category || "ALL",
      sentimentScore:
        typeof item.sentimentScore === "number" ? item.sentimentScore : 0,
      sentimentLabel: item.sentimentLabel || "neutral",
      relevant: item.relevant !== false,
      hiddenReason: item.hiddenReason || null,
    };
  } catch {
    console.error("[Analyzer] Failed to parse response:", raw);
    return { ...DEFAULT_RESULT };
  }
}

/** Analyze multiple articles in a single API call */
async function analyzeBatch(
  articles: { id: string; title: string; content: string | null }[],
): Promise<Map<string, AnalysisResult>> {
  const results = new Map<string, AnalysisResult>();

  const digest = articles
    .map((a, i) => {
      const text = a.content
        ? `${a.title}\n${a.content.slice(0, 800)}`
        : a.title;
      return `${i + 1}. ${text}`;
    })
    .join("\n\n");

  // Scale max_tokens with batch size (~120 tokens per article)
  const maxTokens = Math.min(articles.length * 150, 4000);

  const response = await getClient().chat.completions.create({
    model: "MiniMaxAI/MiniMax-M2.7",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: digest },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";
  const cleaned = raw
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const items: Array<Record<string, unknown>> = Array.isArray(parsed)
      ? parsed
      : [parsed];

    for (const item of items) {
      const idx =
        typeof item.id === "number" ? item.id - 1 : items.indexOf(item);
      const article = articles[idx];
      if (!article) continue;

      results.set(article.id, {
        summary: (item.summary as string) || "No summary available.",
        category: (item.category as string) || "ALL",
        sentimentScore:
          typeof item.sentimentScore === "number" ? item.sentimentScore : 0,
        sentimentLabel: (item.sentimentLabel as string) || "neutral",
        relevant: item.relevant !== false,
        hiddenReason: (item.hiddenReason as string) || null,
      });
    }
  } catch {
    console.error("[Analyzer] Failed to parse batch response:", raw);
  }

  return results;
}

export async function analyzeUnprocessed(limit = 15): Promise<number> {
  const articles = await prisma.article.findMany({
    where: { analyzed: false },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  if (articles.length === 0) return 0;

  // Batch analyze in a single API call
  const batchResults = await analyzeBatch(articles);

  let processed = 0;
  let hidden = 0;

  for (const article of articles) {
    const result = batchResults.get(article.id) || { ...DEFAULT_RESULT };

    try {
      await prisma.article.update({
        where: { id: article.id },
        data: {
          summary: result.summary,
          category: result.category,
          sentimentScore: result.sentimentScore,
          sentimentLabel: result.sentimentLabel,
          analyzed: true,
          hidden: !result.relevant,
          hiddenReason: result.hiddenReason,
        },
      });

      if (!result.relevant) {
        hidden++;
        console.log(
          `[Analyzer] Hidden: "${article.title.slice(0, 80)}" — ${result.hiddenReason}`,
        );
      }

      processed++;
    } catch (error) {
      console.error(
        `[Analyzer] Error saving "${article.title}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (hidden > 0) {
    console.log(`[Analyzer] Processed ${processed}, hidden ${hidden}`);
  }

  return processed;
}

/**
 * Backfill: re-evaluate already-analyzed articles for relevance.
 * Only touches articles that haven't been curated yet (hiddenReason is null and hidden is false).
 */
export async function backfillCuration(
  limit = 20,
): Promise<{ processed: number; hidden: number }> {
  const articles = await prisma.article.findMany({
    where: {
      analyzed: true,
      hidden: false,
      hiddenReason: null,
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: { id: true, title: true, content: true },
  });

  if (articles.length === 0) return { processed: 0, hidden: 0 };

  const batchResults = await analyzeBatch(articles);

  let processed = 0;
  let hidden = 0;

  for (const article of articles) {
    const result = batchResults.get(article.id) || {
      ...DEFAULT_RESULT,
      hiddenReason: "reviewed",
    };

    try {
      await prisma.article.update({
        where: { id: article.id },
        data: {
          hidden: !result.relevant,
          hiddenReason: result.hiddenReason || "reviewed",
          summary: result.summary,
          category: result.category,
          sentimentScore: result.sentimentScore,
          sentimentLabel: result.sentimentLabel,
        },
      });

      if (!result.relevant) {
        hidden++;
        console.log(
          `[Backfill] Hidden: "${article.title.slice(0, 80)}" — ${result.hiddenReason}`,
        );
      }

      processed++;
    } catch (error) {
      console.error(
        `[Backfill] Error on "${article.title.slice(0, 60)}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return { processed, hidden };
}
