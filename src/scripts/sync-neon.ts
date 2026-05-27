import { PrismaClient } from "@prisma/client";

// Ensure environment variables are loaded
const databaseUrl = process.env.DATABASE_URL;
const neonDatabaseUrl = process.env.NEON_DATABASE_URL;

if (!databaseUrl || !neonDatabaseUrl) {
  console.error("ERROR: DATABASE_URL and NEON_DATABASE_URL environment variables must be set.");
  process.exit(1);
}

const local = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

const neon = new PrismaClient({
  datasources: { db: { url: neonDatabaseUrl } },
});

async function syncConfigAndCache() {
  console.log("[Sync] Starting configuration and cache tables sync...");

  // 1. ApiKey
  const apiKeys = await local.apiKey.findMany();
  console.log(`[Sync] ApiKeys: Sourced ${apiKeys.length} keys from local.`);
  for (const item of apiKeys) {
    await neon.apiKey.upsert({
      where: { id: item.id },
      update: { key: item.key, name: item.name, active: item.active },
      create: { id: item.id, key: item.key, name: item.name, active: item.active, createdAt: item.createdAt },
    });
  }

  // 2. CustomSearch
  const customSearches = await local.customSearch.findMany();
  console.log(`[Sync] CustomSearch: Sourced ${customSearches.length} items from local.`);
  for (const item of customSearches) {
    await neon.customSearch.upsert({
      where: { id: item.id },
      update: { query: item.query, provider: item.provider, active: item.active, apiKeyId: item.apiKeyId },
      create: {
        id: item.id,
        query: item.query,
        provider: item.provider,
        active: item.active,
        apiKeyId: item.apiKeyId,
        createdAt: item.createdAt,
      },
    });
  }

  // 3. Source
  const sources = await local.source.findMany();
  console.log(`[Sync] Source: Sourced ${sources.length} sources from local.`);
  for (const item of sources) {
    await neon.source.upsert({
      where: { id: item.id },
      update: { name: item.name, slug: item.slug, feedUrl: item.feedUrl, active: item.active, category: item.category },
      create: {
        id: item.id,
        name: item.name,
        slug: item.slug,
        feedUrl: item.feedUrl,
        active: item.active,
        category: item.category,
      },
    });
  }

  // 4. BrandLogo
  const logos = await local.brandLogo.findMany();
  console.log(`[Sync] BrandLogo: Sourced ${logos.length} brand logos from local.`);
  for (const item of logos) {
    await neon.brandLogo.upsert({
      where: { id: item.id },
      update: { brand: item.brand, keywords: item.keywords, filename: item.filename, source: item.source },
      create: {
        id: item.id,
        brand: item.brand,
        keywords: item.keywords,
        filename: item.filename,
        source: item.source,
        createdAt: item.createdAt,
      },
    });
  }

  // 5. CryptoPrice (Live Cache)
  const cryptoPrices = await local.cryptoPrice.findMany();
  console.log(`[Sync] CryptoPrice: Sourced ${cryptoPrices.length} live prices from local.`);
  // Re-populate live cache table cleanly
  await neon.$transaction([
    neon.cryptoPrice.deleteMany(),
    neon.cryptoPrice.createMany({ data: cryptoPrices, skipDuplicates: true }),
  ]);

  // 6. ForexRate (Live Cache)
  const forexRates = await local.forexRate.findMany();
  console.log(`[Sync] ForexRate: Sourced ${forexRates.length} live forex rates from local.`);
  await neon.$transaction([
    neon.forexRate.deleteMany(),
    neon.forexRate.createMany({ data: forexRates, skipDuplicates: true }),
  ]);

  console.log("[Sync] Configuration and cache tables sync completed successfully!");
}

async function syncArticles() {
  console.log("[Sync] Starting Articles delta-sync...");

  // Find max fetchedAt in Neon
  const maxNeonFetched = await neon.article.aggregate({
    _max: { fetchedAt: true },
  });

  const fetchSince = maxNeonFetched._max.fetchedAt;
  console.log(`[Sync] Neon latest fetchedAt: ${fetchSince ? fetchSince.toISOString() : "None (Full Sync)"}`);

  // Query new articles from local VPS DB
  const newArticles = await local.article.findMany({
    where: fetchSince ? { fetchedAt: { gt: fetchSince } } : {},
    orderBy: { fetchedAt: "asc" },
  });

  console.log(`[Sync] Found ${newArticles.length} new articles to replicate.`);

  if (newArticles.length === 0) return;

  // Insert in batches of 100
  const batchSize = 100;
  let copied = 0;

  for (let i = 0; i < newArticles.length; i += batchSize) {
    const batch = newArticles.slice(i, i + batchSize);
    await neon.article.createMany({
      data: batch,
      skipDuplicates: true,
    });
    copied += batch.length;
    console.log(`  [Sync] Replicated ${copied}/${newArticles.length} articles...`);
  }

  console.log("[Sync] Articles delta-sync completed successfully!");
}

async function syncCryptoPriceHistory() {
  console.log("[Sync] Starting CryptoPriceHistory delta-sync...");

  const maxNeonTimestamp = await neon.cryptoPriceHistory.aggregate({
    _max: { timestamp: true },
  });

  const syncSince = maxNeonTimestamp._max.timestamp;
  console.log(`[Sync] Neon latest CryptoPriceHistory timestamp: ${syncSince ? syncSince.toISOString() : "None (Full Sync)"}`);

  const newHistory = await local.cryptoPriceHistory.findMany({
    where: syncSince ? { timestamp: { gt: syncSince } } : {},
    orderBy: { timestamp: "asc" },
  });

  console.log(`[Sync] Found ${newHistory.length} new price history entries to replicate.`);

  if (newHistory.length === 0) return;

  // Insert in batches of 1000
  const batchSize = 1000;
  let copied = 0;

  for (let i = 0; i < newHistory.length; i += batchSize) {
    const batch = newHistory.slice(i, i + batchSize);
    await neon.cryptoPriceHistory.createMany({
      data: batch,
      skipDuplicates: true,
    });
    copied += batch.length;
    console.log(`  [Sync] Replicated ${copied}/${newHistory.length} price history entries...`);
  }

  console.log("[Sync] CryptoPriceHistory delta-sync completed successfully!");
}

async function syncForexRateHistory() {
  console.log("[Sync] Starting ForexRateHistory delta-sync...");

  const maxNeonTimestamp = await neon.forexRateHistory.aggregate({
    _max: { timestamp: true },
  });

  const syncSince = maxNeonTimestamp._max.timestamp;
  console.log(`[Sync] Neon latest ForexRateHistory timestamp: ${syncSince ? syncSince.toISOString() : "None (Full Sync)"}`);

  const newHistory = await local.forexRateHistory.findMany({
    where: syncSince ? { timestamp: { gt: syncSince } } : {},
    orderBy: { timestamp: "asc" },
  });

  console.log(`[Sync] Found ${newHistory.length} new forex history entries to replicate.`);

  if (newHistory.length === 0) return;

  await neon.forexRateHistory.createMany({
    data: newHistory,
    skipDuplicates: true,
  });

  console.log(`[Sync] Replicated ${newHistory.length} forex history entries.`);
  console.log("[Sync] ForexRateHistory delta-sync completed successfully!");
}

async function syncNewsSummaries() {
  console.log("[Sync] Starting NewsSummary delta-sync...");

  const maxNeonPeriodStart = await neon.newsSummary.aggregate({
    _max: { periodStart: true },
  });

  const syncSince = maxNeonPeriodStart._max.periodStart;
  console.log(`[Sync] Neon latest NewsSummary periodStart: ${syncSince ? syncSince.toISOString() : "None (Full Sync)"}`);

  const newSummaries = await local.newsSummary.findMany({
    where: syncSince ? { periodStart: { gt: syncSince } } : {},
    orderBy: { periodStart: "asc" },
  });

  console.log(`[Sync] Found ${newSummaries.length} new summaries to replicate.`);

  if (newSummaries.length === 0) return;

  await neon.newsSummary.createMany({
    data: newSummaries,
    skipDuplicates: true,
  });

  console.log(`[Sync] Replicated ${newSummaries.length} news summaries.`);
  console.log("[Sync] NewsSummary delta-sync completed successfully!");
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting Incremental Sync to Neon...`);
  const startTime = Date.now();

  try {
    await syncConfigAndCache();
    await syncArticles();
    await syncCryptoPriceHistory();
    await syncForexRateHistory();
    await syncNewsSummaries();

    console.log(`[${new Date().toISOString()}] Sync completed successfully in ${((Date.now() - startTime) / 1000).toFixed(2)}s.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Sync failed:`, error);
    process.exit(1);
  } finally {
    await local.$disconnect();
    await neon.$disconnect();
  }
}

main();
