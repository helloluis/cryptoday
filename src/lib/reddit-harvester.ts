import { prisma } from "./db";

const SUBREDDITS = [
  "cryptocurrency",
  "bitcoin",
  "ethereum",
  "solana",
  "defi",
  "CryptoMarkets",
];

const MIN_SCORE = 20; // minimum upvotes to include
const MIN_TITLE_LENGTH = 20;

interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    permalink: string;
    selftext: string;
    score: number;
    created_utc: number;
    subreddit: string;
    is_self: boolean;
    link_flair_text: string | null;
    stickied: boolean;
    removed_by_category: string | null;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

export async function harvestReddit(): Promise<number> {
  let totalAdded = 0;

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=25`,
        {
          headers: {
            "User-Agent": "CryptoDay-News/1.0 (https://news.cryptoday.live)",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) {
        console.error(`[Reddit] HTTP ${res.status} for r/${sub}`);
        continue;
      }

      const listing: RedditListing = await res.json();
      const posts = listing.data.children || [];

      for (const post of posts) {
        const { data } = post;

        // Skip stickied/removed, low-score, and short titles
        if (data.stickied) continue;
        if (data.removed_by_category) continue;
        if (data.score < MIN_SCORE) continue;
        if (data.title.length < MIN_TITLE_LENGTH) continue;

        const redditUrl = `https://reddit.com${data.permalink}`;

        // Deduplicate by URL
        const exists = await prisma.article.findUnique({ where: { url: redditUrl } });
        if (exists) continue;

        const publishedAt = new Date(data.created_utc * 1000);

        await prisma.article.create({
          data: {
            title: data.title.slice(0, 300),
            url: redditUrl,
            source: `Reddit (r/${data.subreddit})`,
            sourceSlug: "reddit",
            publishedAt,
            content: data.selftext ? data.selftext.slice(0, 2000) : null,
          },
        });

        totalAdded++;
      }

      // Small delay between subreddits to respect rate limits
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`[Reddit] Error harvesting r/${sub}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[Reddit] Added ${totalAdded} posts`);
  return totalAdded;
}
