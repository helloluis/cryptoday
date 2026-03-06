import RssParser from "rss-parser";
import { prisma } from "./db";
import { SOURCES, FeedSource } from "./sources";

const parser = new RssParser({
  timeout: 15000,
  headers: {
    "User-Agent": "CryptoDayNewsBot/1.0",
  },
  customFields: {
    item: [["dc:contributor", "dcContributor"]],
  },
});

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractOriginalSource(item: any, slug: string): string | null {
  // Google News: title format is "Headline - Source Name"
  if (slug === "googlenews") {
    const match = item.title?.match(/\s+-\s+([^-]+)$/);
    return match ? match[1].trim() : null;
  }
  // GlobeNewsWire: dc:contributor contains the company name
  if (slug === "globenewswire") {
    return item.dcContributor?.trim() || null;
  }
  return null;
}

export async function harvestSource(source: FeedSource): Promise<number> {
  let added = 0;

  try {
    const feed = await parser.parseURL(source.feedUrl);
    const items = feed.items.slice(0, 20);

    for (const item of items) {
      if (!item.link || !item.title) continue;

      const url = item.link.split("?")[0];

      const exists = await prisma.article.findUnique({ where: { url } });
      if (exists) continue;

      const content = item.contentSnippet || item.content
        ? stripHtml(item.contentSnippet || item.content || "")
        : undefined;

      const publishedAt = item.pubDate
        ? new Date(item.pubDate)
        : new Date();

      // For aggregator sources, extract the original publication name
      let displaySource = source.name;
      let displayTitle = item.title.trim();
      if (source.isAggregator) {
        const originalPub = extractOriginalSource(item, source.slug);
        if (originalPub) {
          displaySource = `${source.name} (${originalPub})`;
        }
        // Google News appends " - SourceName" to titles — strip it
        if (source.slug === "googlenews") {
          displayTitle = displayTitle.replace(/\s+-\s+[^-]+$/, "");
        }
      }

      await prisma.article.create({
        data: {
          title: displayTitle,
          url,
          source: displaySource,
          sourceSlug: source.slug,
          publishedAt,
          content: content?.slice(0, 2000),
        },
      });

      added++;
    }
  } catch (error) {
    console.error(`[Harvest] Error fetching ${source.name}:`, error instanceof Error ? error.message : error);
  }

  return added;
}

export async function harvestAll(): Promise<{ source: string; added: number }[]> {
  const results: { source: string; added: number }[] = [];

  for (const source of SOURCES) {
    const added = await harvestSource(source);
    results.push({ source: source.name, added });
    // Small delay between sources to be respectful
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}

export async function harvestStaggered(batchIndex: number): Promise<{ source: string; added: number }[]> {
  const batchSize = Math.ceil(SOURCES.length / 4);
  const start = batchIndex * batchSize;
  const batch = SOURCES.slice(start, start + batchSize);

  const results: { source: string; added: number }[] = [];

  for (const source of batch) {
    const added = await harvestSource(source);
    results.push({ source: source.name, added });
    await new Promise((r) => setTimeout(r, 1000));
  }

  return results;
}
