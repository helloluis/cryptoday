import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

// GET: Fetch latest cached crypto prices (quasi-paywalled)
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const isAuthenticated = await validateApiKey(apiKey);

  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();

  try {
    if (symbol) {
      if (symbol !== "BTCUSDT" && symbol !== "BTCUSD" && !isAuthenticated) {
        return NextResponse.json(
          {
            error: "Payment Required",
            notice: "Access to altcoin prices requires an API key or an x402 payment. Only BTCUSDT is available for free.",
          },
          { status: 402 }
        );
      }

      const querySymbol = symbol === "BTCUSD" ? "BTCUSDT" : symbol;

      const price = await prisma.cryptoPrice.findUnique({
        where: { symbol: querySymbol },
      });
      return NextResponse.json({ price });
    }

    if (isAuthenticated) {
      const prices = await prisma.cryptoPrice.findMany({
        orderBy: { symbol: "asc" },
      });
      return NextResponse.json({ prices });
    } else {
      const btcPrice = await prisma.cryptoPrice.findUnique({
        where: { symbol: "BTCUSDT" },
      });
      return NextResponse.json({
        prices: btcPrice ? [btcPrice] : [],
        notice: "Free tier limited to BTCUSDT. To unlock all 600+ Binance spot pairs, pass a valid x-api-key header.",
      });
    }
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
    const response = await fetch("https://api.binance.com/api/v3/ticker/price", {
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      throw new Error(`Binance API returned HTTP ${response.status}`);
    }

    const allTickers = (await response.json()) as Array<{ symbol: string; price: string }>;
    
    const filtered = allTickers.filter(
      (t) => t.symbol.endsWith("USDT") && !t.symbol.includes("UP") && !t.symbol.includes("DOWN")
    );

    const upsertQueries = filtered.map((ticker) => {
      const priceVal = parseFloat(ticker.price);
      return prisma.cryptoPrice.upsert({
        where: { symbol: ticker.symbol },
        update: { price: priceVal },
        create: { symbol: ticker.symbol, price: priceVal },
      });
    });

    const results = await prisma.$transaction(upsertQueries);

    await prisma.cryptoPriceHistory.createMany({
      data: filtered.map((ticker) => ({
        symbol: ticker.symbol,
        price: parseFloat(ticker.price),
      })),
    });

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
