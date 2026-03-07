import RssParser from "rss-parser";
import { prisma } from "./db";

const parser = new RssParser({
  timeout: 15000,
  headers: { "User-Agent": "CryptoDayNewsBot/1.0" },
  customFields: { item: [["dc:contributor", "dcContributor"]] },
});

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function buildGoogleNewsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

function buildGnwUrl(query: string): string {
  const q = encodeURIComponent(query);
  return `https://www.globenewswire.com/RssFeed/keyword/${q}`;
}

async function harvestFeed(
  feedUrl: string,
  provider: string,
  query: string,
  apiKeyId: string
): Promise<number> {
  let added = 0;

  try {
    const feed = await parser.parseURL(feedUrl);
    const items = feed.items.slice(0, 10);

    for (const item of items) {
      if (!item.link || !item.title) continue;

      const url = item.link.split("?")[0];
      const exists = await prisma.article.findUnique({ where: { url } });
      if (exists) continue;

      const content = item.contentSnippet || item.content
        ? stripHtml(item.contentSnippet || item.content || "")
        : undefined;

      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

      // Extract original source for Google News
      let displayTitle = item.title.trim();
      let displaySource = provider === "google" ? "Google News" : "GlobeNewsWire";
      if (provider === "google") {
        const sourceMatch = displayTitle.match(/\s+-\s+([^-]+)$/);
        if (sourceMatch) {
          displaySource = `Google News (${sourceMatch[1].trim()})`;
          displayTitle = displayTitle.replace(/\s+-\s+[^-]+$/, "");
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contrib = (item as any).dcContributor?.trim();
        if (contrib) displaySource = `GlobeNewsWire (${contrib})`;
      }

      await prisma.article.create({
        data: {
          title: displayTitle,
          url,
          source: displaySource,
          sourceSlug: "custom",
          publishedAt,
          content: content?.slice(0, 2000),
          apiKeyId,
          searchQuery: query,
        },
      });

      added++;
    }
  } catch (error) {
    console.error(`[Custom Search] Error fetching "${query}" from ${provider}:`, error instanceof Error ? error.message : error);
  }

  return added;
}

export async function harvestCustomSearches(): Promise<{ query: string; added: number }[]> {
  const searches = await prisma.customSearch.findMany({
    where: { active: true },
    include: { apiKey: { select: { id: true, active: true } } },
  });

  const results: { query: string; added: number }[] = [];

  for (const search of searches) {
    if (!search.apiKey.active) continue;

    let added = 0;

    if (search.provider === "google" || search.provider === "both") {
      added += await harvestFeed(buildGoogleNewsUrl(search.query), "google", search.query, search.apiKeyId);
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (search.provider === "gnw" || search.provider === "both") {
      added += await harvestFeed(buildGnwUrl(search.query), "gnw", search.query, search.apiKeyId);
      await new Promise((r) => setTimeout(r, 1000));
    }

    results.push({ query: search.query, added });
  }

  console.log(`[Custom Search] Processed ${searches.length} searches, total added: ${results.reduce((s, r) => s + r.added, 0)}`);
  return results;
}
