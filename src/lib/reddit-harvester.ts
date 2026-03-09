import { prisma } from "./db";

const SUBREDDITS = [
  "cryptocurrency",
  "bitcoin",
  "ethereum",
  "solana",
  "defi",
  "CryptoMarkets",
];

const MIN_TITLE_LENGTH = 30;

// Reddit blocks JSON API from datacenter IPs, but RSS feeds work fine
async function fetchSubredditRSS(sub: string): Promise<Array<{ title: string; link: string; author: string; published: Date }>> {
  const res = await fetch(`https://www.reddit.com/r/${sub}/hot.rss`, {
    headers: { "User-Agent": "CryptoDay-News/1.0 (https://news.cryptoday.live)" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`[Reddit] HTTP ${res.status} for r/${sub}`);
    return [];
  }

  const xml = await res.text();
  const entries: Array<{ title: string; link: string; author: string; published: Date }> = [];

  // Parse Atom feed entries with regex (lightweight, no XML dep)
  const entryBlocks = xml.split("<entry>").slice(1);

  for (const block of entryBlocks) {
    const title = block.match(/<title>([\\s\\S]*?)<\/title>/)?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() || "";
    const link = block.match(/<link href="([^"]+)"/)?.[1] || "";
    const author = block.match(/<name>([^<]+)<\/name>/)?.[1] || "";
    const updated = block.match(/<updated>([^<]+)<\/updated>/)?.[1];
    const published = updated ? new Date(updated) : new Date();

    if (title && link) {
      entries.push({ title, link, author, published });
    }
  }

  return entries;
}

export async function harvestReddit(): Promise<number> {
  let totalAdded = 0;

  for (const sub of SUBREDDITS) {
    try {
      const entries = await fetchSubredditRSS(sub);

      let skippedShort = 0, skippedAutomod = 0, skippedDupe = 0;

      for (const entry of entries) {
        // Skip short titles
        if (entry.title.length < MIN_TITLE_LENGTH) { skippedShort++; continue; }

        // Skip AutoModerator posts (daily discussion threads, etc.)
        if (entry.author === "/u/AutoModerator") { skippedAutomod++; continue; }

        // Normalize Reddit URL
        const redditUrl = entry.link.replace(/\/$/, "");

        // Deduplicate by URL
        const exists = await prisma.article.findUnique({ where: { url: redditUrl } });
        if (exists) { skippedDupe++; continue; }

        await prisma.article.create({
          data: {
            title: entry.title.slice(0, 300),
            url: redditUrl,
            source: `Reddit (r/${sub})`,
            sourceSlug: "reddit",
            publishedAt: entry.published,
            content: null,
          },
        });

        totalAdded++;
      }

      console.log(`[Reddit] r/${sub}: Short=${skippedShort} Automod=${skippedAutomod} Dupe=${skippedDupe} Added=${totalAdded}`);

      // Small delay between subreddits
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`[Reddit] Error harvesting r/${sub}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[Reddit] Added ${totalAdded} posts`);
  return totalAdded;
}
