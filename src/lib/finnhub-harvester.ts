import { prisma } from "./db";

const FILTER_PATTERNS = [
  /\bearnings call\b/i,
  /\bprice target\b/i,
  /\b52.week\b/i,
  /\bPE ratio\b/i,
  /\bvaluation check\b/i,
  /\bstock fund price\b/i,
];

interface FinnhubArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export async function harvestFinnhub(): Promise<number> {
  const apiKey = process.env.FINNHUB_API_KEY || "d6iet11r01ql9cig2oj0d6iet11r01ql9cig2ojg";
  if (!apiKey) {
    console.error("[Finnhub] API Key not found!");
    return 0;
  }

  let totalAdded = 0;
  const categories = ["general", "crypto"];

  for (const category of categories) {
    try {
      console.log(`[Finnhub] Harvesting category: ${category}...`);
      const response = await fetch(
        `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`,
        { signal: AbortSignal.timeout(12000) }
      );

      if (!response.ok) {
        console.error(`[Finnhub] API returned HTTP ${response.status} for category ${category}`);
        continue;
      }

      const items = (await response.json()) as FinnhubArticle[];
      if (!Array.isArray(items)) {
        console.error(`[Finnhub] Unexpected API response shape for category ${category}`);
        continue;
      }

      // Take latest 30 items
      const latestItems = items.slice(0, 30);
      let categoryAdded = 0;

      for (const item of latestItems) {
        if (!item.url || !item.headline) continue;

        // Strip queries from URLs for unique matching
        const cleanUrl = item.url.split("?")[0];

        // Deduplicate
        const exists = await prisma.article.findUnique({ where: { url: cleanUrl } });
        if (exists) continue;

        // Apply strict headline filtering
        const matchesFilter = FILTER_PATTERNS.some((pattern) => pattern.test(item.headline));
        if (matchesFilter) {
          console.log(`[Finnhub] Dropped headline matching filter: "${item.headline}"`);
          continue;
        }

        // Insert
        await prisma.article.create({
          data: {
            title: item.headline.slice(0, 300),
            url: cleanUrl,
            source: item.source ? `Finnhub (${item.source})` : "Finnhub",
            sourceSlug: "finnhub",
            publishedAt: new Date(item.datetime * 1000),
            content: item.summary ? item.summary.slice(0, 2000) : null,
          },
        });

        categoryAdded++;
        totalAdded++;
      }

      console.log(`[Finnhub] Category "${category}": Added ${categoryAdded} articles.`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Respectful pause
    } catch (error) {
      console.error(
        `[Finnhub] Error harvesting category ${category}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return totalAdded;
}
