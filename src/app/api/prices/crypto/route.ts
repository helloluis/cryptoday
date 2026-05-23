import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET: Fetch latest cached crypto prices
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();

  try {
    if (symbol) {
      const price = await prisma.cryptoPrice.findUnique({
        where: { symbol },
      });
      return NextResponse.json({ price });
    }

    const prices = await prisma.cryptoPrice.findMany({
      orderBy: { symbol: "asc" },
    });
    return NextResponse.json({ prices });
  } catch (error) {
    console.error("[CryptoPrices] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}

// POST: Harvest latest crypto prices from Binance API (all non-leveraged USDT spot pairs, 600+)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch latest prices from Binance
    const response = await fetch("https://api.binance.com/api/v3/ticker/price", {
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      throw new Error(`Binance API returned HTTP ${response.status}`);
    }

    const allTickers = (await response.json()) as Array<{ symbol: string; price: string }>;
    
    // Filter to retrieve all USDT spot pairs, excluding leveraged tokens (UP/DOWN)
    const filtered = allTickers.filter(
      (t) => t.symbol.endsWith("USDT") && !t.symbol.includes("UP") && !t.symbol.includes("DOWN")
    );

    // 2. Upsert current prices in a single optimized database transaction
    const upsertQueries = filtered.map((ticker) => {
      const priceVal = parseFloat(ticker.price);
      return prisma.cryptoPrice.upsert({
        where: { symbol: ticker.symbol },
        update: { price: priceVal },
        create: { symbol: ticker.symbol, price: priceVal },
      });
    });

    const results = await prisma.$transaction(upsertQueries);

    // 3. Write all history logs in a single highly performant bulk insert
    await prisma.cryptoPriceHistory.createMany({
      data: filtered.map((ticker) => ({
        symbol: ticker.symbol,
        price: parseFloat(ticker.price),
      })),
    });

    // 4. Prune history older than 48 hours to prevent database bloat
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pruned = await prisma.cryptoPriceHistory.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    return NextResponse.json({
      success: true,
      updated: results.length,
      pruned: pruned.count,
      prices: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CryptoPrices] Harvest POST error:", error);
    return NextResponse.json(
      { error: "Harvest failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
