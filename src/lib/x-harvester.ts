import { TwitterApi } from "twitter-api-v2";
import { prisma } from "./db";

const CRYPTO_KEYWORDS = /\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|blockchain|defi|nft|web3|altcoin|stablecoin|token|airdrop|dao|dex|cex|binance|coinbase|kraken|ledger|memecoin|layer.?2|rollup|zk|ordinals|rune|taproot|staking|yield|liquidity|swap|bridge|whale|hodl|halving|etf|sec|cftc|regulation|on.?chain|smart.?contract|wallet|mining|validator|consensus|fork|gas.?fee|tvl|market.?cap|bull|bear|pump|dump|rug.?pull|audit)\b/i;

const MIN_TWEET_LENGTH = 80;
const MIN_FOLLOWERS = 50_000;

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
      "user.fields": "username,name,public_metrics",
    });

    const users = Object.fromEntries(
      (timeline.includes?.users || []).map((u) => [
        u.id,
        { username: u.username, name: u.name, followers: u.public_metrics?.followers_count || 0 },
      ])
    );

    const tweets = timeline.data.data || [];
    let skippedShort = 0, skippedRT = 0, skippedKeyword = 0, skippedDupe = 0, skippedFollowers = 0;
    console.log(`[X Harvest] Fetched ${tweets.length} tweets`);

    for (const tweet of tweets) {
      // Skip short tweets (personal posts, reactions)
      if (tweet.text.length < MIN_TWEET_LENGTH) { skippedShort++; continue; }

      // Skip retweets — they'll likely appear from original source
      if (tweet.text.startsWith("RT @")) { skippedRT++; continue; }

      // Must contain crypto-related keywords
      if (!CRYPTO_KEYWORDS.test(tweet.text)) { skippedKeyword++; continue; }

      // Only include tweets from accounts with 50k+ followers
      const user = users[tweet.author_id || ""];
      if (!user || user.followers < MIN_FOLLOWERS) { skippedFollowers++; continue; }

      const username = user.username || "unknown";
      const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;

      // Deduplicate by URL
      const exists = await prisma.article.findUnique({ where: { url: tweetUrl } });
      if (exists) { skippedDupe++; continue; }

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

    console.log(`[X Harvest] Short: ${skippedShort}, RTs: ${skippedRT}, No keyword: ${skippedKeyword}, <${MIN_FOLLOWERS} followers: ${skippedFollowers}, Dupes: ${skippedDupe}, Added: ${added}`);
  } catch (error) {
    console.error("[X Harvest] Error:", error instanceof Error ? error.message : error);
  }

  return added;
}
