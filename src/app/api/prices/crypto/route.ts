import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const TRACKED_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "LINKUSDT",
];

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

// POST: Harvest latest crypto prices from Binance API
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch latest prices from Binance
    const response = await fetch("https://api.binance.com/api/v3/ticker/price", {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Binance API returned HTTP ${response.status}`);
    }

    const allTickers = (await response.json()) as Array<{ symbol: string; price: string }>;
    const filtered = allTickers.filter((t) => TRACKED_SYMBOLS.includes(t.symbol));

    const results = [];

    // 2. Insert/Update in DB and log to history
    for (const ticker of filtered) {
      const priceVal = parseFloat(ticker.price);

      // Upsert current price
      const current = await prisma.cryptoPrice.upsert({
        where: { symbol: ticker.symbol },
        update: { price: priceVal },
        create: { symbol: ticker.symbol, price: priceVal },
      });

      // Write to history
      await prisma.cryptoPriceHistory.create({
        data: {
          symbol: ticker.symbol,
          price: priceVal,
        },
      });

      results.push(current);
    }

    // 3. Prune history older than 48 hours to prevent database bloat
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
