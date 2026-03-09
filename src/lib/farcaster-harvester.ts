import { prisma } from "./db";

const HUB_URL = "https://hub.pinata.cloud";

// Well-known Farcaster channel parent URLs
const CHANNELS: { name: string; url: string }[] = [
  { name: "crypto", url: "https://warpcast.com/~/channel/crypto" },
  { name: "bitcoin", url: "https://warpcast.com/~/channel/bitcoin" },
  { name: "ethereum", url: "https://warpcast.com/~/channel/ethereum" },
  { name: "defi", url: "https://warpcast.com/~/channel/defi" },
  { name: "solana", url: "https://warpcast.com/~/channel/solana" },
  { name: "base", url: "https://warpcast.com/~/channel/base" },
];

const MIN_CAST_LENGTH = 100;

// Spam / low-quality patterns to reject
const SPAM_PATTERNS = [
  /\b(airdrop|free mint|claim now|join now|whitelist|presale)\b/i,
  /\b(1000x|100x|moonshot|guaranteed|send \d+ get \d+)\b/i,
  /\b(follow me|like and rt|giveaway|dm me)\b/i,
  /[\u{1F680}\u{1F4B0}\u{1F525}\u{1F4A5}]{3,}/u, // 3+ rocket/money/fire emojis in a row
];

// Must reference something substantive — news, analysis, data
const QUALITY_SIGNALS = /\b(announced|launched|report|according|raised|partnership|update|release|proposal|vote|hack|exploit|SEC|ETF|approval|ruling|billion|million|protocol|upgrade|fork|merge|audit|vulnerability|regulation|compliance|IPO|listing|acquisition|fund)\b/i;

interface CastMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    castAddBody?: {
      text: string;
      parentUrl?: string;
      parentCastId?: { fid: number; hash: string };
      embeds?: Array<{ url?: string }>;
    };
  };
  hash: string;
}

interface CastsByParentResponse {
  messages: CastMessage[];
  nextPageToken?: string;
}

export async function harvestFarcaster(): Promise<number> {
  let totalAdded = 0;

  for (const channel of CHANNELS) {
    try {
      const encodedUrl = encodeURIComponent(channel.url);
      const res = await fetch(
        `${HUB_URL}/v1/castsByParent?url=${encodedUrl}&pageSize=20&reverse=true`,
        {
          headers: { "User-Agent": "CryptoDay-News/1.0" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) {
        console.error(`[Farcaster] HTTP ${res.status} for channel ${channel.name}`);
        continue;
      }

      const data: CastsByParentResponse = await res.json();
      const casts = data.messages || [];

      let skippedShort = 0, skippedReply = 0, skippedSpam = 0, skippedNoSignal = 0, skippedDupe = 0;

      for (const cast of casts) {
        const body = cast.data?.castAddBody;
        if (!body?.text) continue;

        // Skip short casts — need enough substance to be newsworthy
        if (body.text.length < MIN_CAST_LENGTH) { skippedShort++; continue; }

        // Skip replies — only want top-level channel posts
        if (body.parentCastId) { skippedReply++; continue; }

        // Skip spam/shilling
        if (SPAM_PATTERNS.some((p) => p.test(body.text))) { skippedSpam++; continue; }

        // Must have a link embed OR contain quality signal words
        const hasEmbed = body.embeds?.some((e) => e.url);
        const hasQualitySignal = QUALITY_SIGNALS.test(body.text);
        if (!hasEmbed && !hasQualitySignal) { skippedNoSignal++; continue; }

        // Farcaster timestamps are seconds since Jan 1, 2021 00:00:00 UTC (Farcaster epoch)
        const FARCASTER_EPOCH = 1609459200; // 2021-01-01T00:00:00Z
        const publishedAt = new Date((cast.data.timestamp + FARCASTER_EPOCH) * 1000);

        // Build Warpcast URL from hash and FID
        const hashHex = cast.hash.startsWith("0x") ? cast.hash : `0x${cast.hash}`;
        const castUrl = `https://warpcast.com/~/conversations/${hashHex}`;

        // Deduplicate by URL
        const exists = await prisma.article.findUnique({ where: { url: castUrl } });
        if (exists) { skippedDupe++; continue; }

        // Use first embed URL if available (often links to articles)
        const embedUrl = body.embeds?.find((e) => e.url)?.url;

        await prisma.article.create({
          data: {
            title: body.text.slice(0, 300).replace(/\n/g, " "),
            url: embedUrl || castUrl,
            source: `Farcaster (/${channel.name})`,
            sourceSlug: "farcaster",
            publishedAt,
            content: body.text,
          },
        });

        totalAdded++;
      }

      console.log(`[Farcaster] /${channel.name}: Short=${skippedShort} Reply=${skippedReply} Spam=${skippedSpam} NoSignal=${skippedNoSignal} Dupe=${skippedDupe} Added=${totalAdded}`);

      // Small delay between channels
      await new Promise((r) => setTimeout(r, 500));
    } catch (error) {
      console.error(`[Farcaster] Error harvesting /${channel.name}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[Farcaster] Added ${totalAdded} casts`);
  return totalAdded;
}
