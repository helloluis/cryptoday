import { prisma } from "./db";

// Neynar free API — provides cast reactions, follower counts, embeds
const NEYNAR_API = "https://api.neynar.com/v2/farcaster";
const NEYNAR_KEY = process.env.NEYNAR_API_KEY || "NEYNAR_API_DOCS"; // free demo key

const CHANNELS = ["crypto", "bitcoin", "ethereum", "defi", "solana", "base"];

const MIN_CAST_LENGTH = 80;
const MIN_LIKES = 2; // minimum likes to be worth ingesting
const MIN_FOLLOWER_COUNT = 100;

// Spam / low-quality patterns to reject
const SPAM_PATTERNS = [
  /\b(airdrop|free mint|claim now|join now|whitelist|presale)\b/i,
  /\b(1000x|100x|moonshot|guaranteed|send \d+ get \d+)\b/i,
  /\b(follow me|like and rt|giveaway|dm me)\b/i,
  /[\u{1F680}\u{1F4B0}\u{1F525}\u{1F4A5}]{3,}/u, // 3+ rocket/money/fire emojis in a row
];

interface NeynarCast {
  hash: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    follower_count: number;
  };
  text: string;
  timestamp: string;
  embeds: Array<{ url?: string }>;
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
  replies: { count: number };
  parent_hash: string | null;
}

interface NeynarFeedResponse {
  casts: NeynarCast[];
  next?: { cursor: string };
}

export async function harvestFarcaster(): Promise<number> {
  let totalAdded = 0;

  for (const channel of CHANNELS) {
    try {
      const res = await fetch(
        `${NEYNAR_API}/feed/channels?channel_ids=${channel}&limit=25&should_moderate=true`,
        {
          headers: {
            accept: "application/json",
            "x-api-key": NEYNAR_KEY,
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) {
        console.error(`[Farcaster] HTTP ${res.status} for /${channel}`);
        continue;
      }

      const data: NeynarFeedResponse = await res.json();
      const casts = data.casts || [];

      let skippedShort = 0, skippedReply = 0, skippedSpam = 0,
          skippedLikes = 0, skippedFollowers = 0, skippedDupe = 0;

      for (const cast of casts) {
        if (!cast.text) continue;

        // Skip short casts
        if (cast.text.length < MIN_CAST_LENGTH) { skippedShort++; continue; }

        // Skip replies — only top-level channel posts
        if (cast.parent_hash) { skippedReply++; continue; }

        // Skip spam/shilling
        if (SPAM_PATTERNS.some((p) => p.test(cast.text))) { skippedSpam++; continue; }

        // Quality gate: minimum engagement
        if (cast.reactions.likes_count < MIN_LIKES) { skippedLikes++; continue; }

        // Skip low-follower accounts
        if (cast.author.follower_count < MIN_FOLLOWER_COUNT) { skippedFollowers++; continue; }

        const castUrl = `https://warpcast.com/${cast.author.username}/${cast.hash.slice(0, 10)}`;

        // Deduplicate by URL
        const exists = await prisma.article.findUnique({ where: { url: castUrl } });
        if (exists) { skippedDupe++; continue; }

        const publishedAt = new Date(cast.timestamp);

        // Use first embed URL if available (often links to articles)
        const embedUrl = cast.embeds?.find((e) => e.url)?.url;

        await prisma.article.create({
          data: {
            title: cast.text.slice(0, 300).replace(/\n/g, " "),
            url: embedUrl || castUrl,
            source: `Farcaster (/${channel})`,
            sourceSlug: "farcaster",
            publishedAt,
            content: cast.text,
          },
        });

        totalAdded++;
      }

      console.log(
        `[Farcaster] /${channel}: Short=${skippedShort} Reply=${skippedReply} Spam=${skippedSpam} ` +
        `<${MIN_LIKES}likes=${skippedLikes} <${MIN_FOLLOWER_COUNT}foll=${skippedFollowers} Dupe=${skippedDupe} Added=${totalAdded}`
      );

      // Small delay between channels
      await new Promise((r) => setTimeout(r, 500));
    } catch (error) {
      console.error(`[Farcaster] Error harvesting /${channel}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[Farcaster] Added ${totalAdded} casts`);
  return totalAdded;
}
