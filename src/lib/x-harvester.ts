import { TwitterApi } from "twitter-api-v2";
import { prisma } from "./db";

const CRYPTO_KEYWORDS = /\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|blockchain|defi|nft|web3|altcoin|stablecoin|token|airdrop|dao|dex|cex|binance|coinbase|kraken|ledger|memecoin|layer.?2|rollup|zk|ordinals|rune|taproot|staking|yield|liquidity|swap|bridge|whale|hodl|halving|etf|sec|cftc|regulation|on.?chain|smart.?contract|wallet|mining|validator|consensus|fork|gas.?fee|tvl|market.?cap|bull|bear|pump|dump|rug.?pull|audit)\b/i;

const MIN_TWEET_LENGTH = 80;

function getClient(): TwitterApi | null {
  const { X_API_KEY, X_API_SECRET, X_API_ACCESS_TOKEN, X_API_ACCESS_TOKEN_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_API_ACCESS_TOKEN || !X_API_ACCESS_TOKEN_SECRET) {
    return null;
  }
  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_API_ACCESS_TOKEN,
    accessSecret: X_API_ACCESS_TOKEN_SECRET,
  });
}

export async function harvestXTimeline(): Promise<number> {
  const client = getClient();
  if (!client) {
    console.error("[X Harvest] Missing X API credentials");
    return 0;
  }

  let added = 0;

  try {
    const timeline = await client.v2.homeTimeline({
      max_results: 100,
      "tweet.fields": "created_at,author_id,text,entities",
      expansions: "author_id",
      "user.fields": "username,name",
    });

    const users = Object.fromEntries(
      (timeline.includes?.users || []).map((u) => [u.id, { username: u.username, name: u.name }])
    );

    for (const tweet of timeline.data.data || []) {
      // Skip short tweets (personal posts, reactions)
      if (tweet.text.length < MIN_TWEET_LENGTH) continue;

      // Skip retweets — they'll likely appear from original source
      if (tweet.text.startsWith("RT @")) continue;

      // Must contain crypto-related keywords
      if (!CRYPTO_KEYWORDS.test(tweet.text)) continue;

      const user = users[tweet.author_id || ""];
      const username = user?.username || "unknown";
      const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;

      // Deduplicate by URL
      const exists = await prisma.article.findUnique({ where: { url: tweetUrl } });
      if (exists) continue;

      const publishedAt = tweet.created_at ? new Date(tweet.created_at) : new Date();

      await prisma.article.create({
        data: {
          title: tweet.text.slice(0, 200).replace(/\n/g, " "),
          url: tweetUrl,
          source: `X (via @${username})`,
          sourceSlug: "x",
          publishedAt,
          content: tweet.text,
        },
      });

      added++;
    }
  } catch (error) {
    console.error("[X Harvest] Error:", error instanceof Error ? error.message : error);
  }

  return added;
}
