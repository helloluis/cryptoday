import { PrismaClient, type Article, type CryptoPriceHistory, type ForexRateHistory, type NewsSummary } from "@prisma/client";
import { copyConfig, copyHistory } from "./neon-sync";

const databaseUrl = process.env.DATABASE_URL;
const neonDatabaseUrl = process.env.NEON_DATABASE_URL;
if (!databaseUrl || !neonDatabaseUrl) {
  console.error("DATABASE_URL and NEON_DATABASE_URL must be set.");
  process.exit(1);
}
const sourceHost = new URL(databaseUrl).hostname;
const destinationHost = new URL(neonDatabaseUrl).hostname;
if (!destinationHost.endsWith(".neon.tech") || sourceHost === destinationHost) {
  throw new Error("Refusing mirror: destination must be a separate Neon database");
}
const local = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const neon = new PrismaClient({ datasources: { db: { url: neonDatabaseUrl } } });

async function main() {
  const started = Date.now();
  const [clock] = await local.$queryRaw<{ through: Date }[]>`SELECT CURRENT_TIMESTAMP AS through`;
  const through = clock.through;
  console.log(`[${new Date().toISOString()}] Starting batched Neon mirror...`);
  const execute = (query: Parameters<typeof neon.$executeRaw>[0]) => neon.$executeRaw(query);
  for (const [table, rows] of [
    ["ApiKey", await local.apiKey.findMany()],
    ["CustomSearch", await local.customSearch.findMany()],
    ["Source", await local.source.findMany()],
    ["BrandLogo", await local.brandLogo.findMany()],
  ] as const) {
    const changed = await copyConfig(table, rows, execute);
    console.log(`[Sync] ${table}: ${rows.length} checked, ${changed} changed`);
  }

  // Preserve atomic replacement of the two small live caches.
  const cryptoPrices = await local.cryptoPrice.findMany();
  await neon.$transaction([
    neon.cryptoPrice.deleteMany(),
    neon.cryptoPrice.createMany({ data: cryptoPrices, skipDuplicates: true }),
  ]);
  const forexRates = await local.forexRate.findMany();
  await neon.$transaction([
    neon.forexRate.deleteMany(),
    neon.forexRate.createMany({ data: forexRates, skipDuplicates: true }),
  ]);

  const articles = await copyHistory<Article>({
    through,
    latest: async () => (await neon.article.aggregate({ _max: { fetchedAt: true } }))._max.fetchedAt,
    timestamp: (row) => row.fetchedAt,
    read: ({ from, through, cursor, take }) => local.article.findMany({
      where: { fetchedAt: { gte: from, lte: through }, ...(cursor ? {
        OR: [{ fetchedAt: { gt: cursor.at } }, { fetchedAt: cursor.at, id: { gt: cursor.id } }],
      } : {}) },
      orderBy: [{ fetchedAt: "asc" }, { id: "asc" }], take,
    }),
    write: (data) => neon.article.createMany({ data, skipDuplicates: true }),
  });
  console.log(`[Sync] Article: ${articles.read} checked, ${articles.inserted} inserted`);

  const prices = await copyHistory<CryptoPriceHistory>({
    through,
    latest: async () => (await neon.cryptoPriceHistory.aggregate({ _max: { timestamp: true } }))._max.timestamp,
    timestamp: (row) => row.timestamp,
    read: ({ from, through, cursor, take }) => local.cryptoPriceHistory.findMany({
      where: { timestamp: { gte: from, lte: through }, ...(cursor ? {
        OR: [{ timestamp: { gt: cursor.at } }, { timestamp: cursor.at, id: { gt: cursor.id } }],
      } : {}) },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }], take,
    }),
    write: (data) => neon.cryptoPriceHistory.createMany({ data, skipDuplicates: true }),
  });
  console.log(`[Sync] CryptoPriceHistory: ${prices.read} checked, ${prices.inserted} inserted`);

  const forex = await copyHistory<ForexRateHistory>({
    through,
    latest: async () => (await neon.forexRateHistory.aggregate({ _max: { timestamp: true } }))._max.timestamp,
    timestamp: (row) => row.timestamp,
    read: ({ from, through, cursor, take }) => local.forexRateHistory.findMany({
      where: { timestamp: { gte: from, lte: through }, ...(cursor ? {
        OR: [{ timestamp: { gt: cursor.at } }, { timestamp: cursor.at, id: { gt: cursor.id } }],
      } : {}) },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }], take,
    }),
    write: (data) => neon.forexRateHistory.createMany({ data, skipDuplicates: true }),
  });
  console.log(`[Sync] ForexRateHistory: ${forex.read} checked, ${forex.inserted} inserted`);

  const summaries = await copyHistory<NewsSummary>({
    through,
    latest: async () => (await neon.newsSummary.aggregate({ _max: { periodStart: true } }))._max.periodStart,
    timestamp: (row) => row.periodStart,
    read: ({ from, through, cursor, take }) => local.newsSummary.findMany({
      where: { periodStart: { gte: from, lte: through }, ...(cursor ? {
        OR: [{ periodStart: { gt: cursor.at } }, { periodStart: cursor.at, id: { gt: cursor.id } }],
      } : {}) },
      orderBy: [{ periodStart: "asc" }, { id: "asc" }], take,
    }),
    write: (data) => neon.newsSummary.createMany({ data, skipDuplicates: true }),
  });
  console.log(`[Sync] NewsSummary: ${summaries.read} checked, ${summaries.inserted} inserted`);
  console.log(`[${new Date().toISOString()}] Sync completed successfully in ${((Date.now() - started) / 1000).toFixed(2)}s.`);
}

main().catch((error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "unknown";
  console.error(`[Sync] Mirror failed (${code}); committed pages are safe to replay.`);
  process.exitCode = 1;
}).finally(async () => {
  await Promise.allSettled([local.$disconnect(), neon.$disconnect()]);
});
