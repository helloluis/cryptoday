import OpenAI from "openai";
import { prisma } from "./db";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

const CRYPTO_TOKENS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC",
  "LINK", "UNI", "ATOM", "LTC", "FIL", "APT", "ARB", "OP", "SUI", "SEI",
  "NEAR", "PEPE", "SHIB", "TRX", "TON", "HBAR", "ICP", "INJ", "TIA", "JUP",
];

interface AnalysisResult {
  summary: string;
  category: string;
  sentimentScore: number;
  sentimentLabel: string;
}

export async function analyzeArticle(
  title: string,
  content: string | null
): Promise<AnalysisResult> {
  const text = content ? `${title}\n\n${content.slice(0, 1500)}` : title;

  const response = await client.chat.completions.create({
    model: "qwen3.5-plus",
    messages: [
      {
        role: "system",
        content: `You are a crypto news analyst. Given a news article, respond with ONLY valid JSON (no markdown, no code fences) in this exact format:
{"summary":"1-2 sentence summary","category":"TOKEN_SYMBOL or ALL","sentimentScore":0.0,"sentimentLabel":"label"}

Rules:
- summary: concise 1-2 sentence summary of the key takeaway
- category: if the article is primarily about a specific cryptocurrency, use its ticker symbol (${CRYPTO_TOKENS.join(", ")}). If it covers multiple or general crypto news, use "ALL". If about DeFi generally, use "DEFI". If about NFTs, use "NFT". If about regulation, use "REG".
- sentimentScore: a float from -1.0 (very bearish) to 1.0 (very bullish), where 0 is neutral
- sentimentLabel: one of "very_bearish", "bearish", "neutral", "bullish", "very_bullish"

Respond with ONLY the JSON object. No other text.`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  const raw = response.choices[0]?.message?.content?.trim() || "";

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || "No summary available.",
      category: parsed.category || "ALL",
      sentimentScore: typeof parsed.sentimentScore === "number" ? parsed.sentimentScore : 0,
      sentimentLabel: parsed.sentimentLabel || "neutral",
    };
  } catch {
    console.error("[Analyzer] Failed to parse response:", raw);
    return {
      summary: "Analysis unavailable.",
      category: "ALL",
      sentimentScore: 0,
      sentimentLabel: "neutral",
    };
  }
}

export async function analyzeUnprocessed(limit = 10): Promise<number> {
  const articles = await prisma.article.findMany({
    where: { analyzed: false },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });

  let processed = 0;

  for (const article of articles) {
    try {
      const result = await analyzeArticle(article.title, article.content);

      await prisma.article.update({
        where: { id: article.id },
        data: {
          summary: result.summary,
          category: result.category,
          sentimentScore: result.sentimentScore,
          sentimentLabel: result.sentimentLabel,
          analyzed: true,
        },
      });

      processed++;
      // Rate limit: small delay between API calls
      await new Promise((r) => setTimeout(r, 500));
    } catch (error) {
      console.error(`[Analyzer] Error analyzing "${article.title}":`, error instanceof Error ? error.message : error);
    }
  }

  return processed;
}
