import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const TRACKED_CURRENCIES = [
  "EUR",
  "PHP",
  "SGD",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "HKD",
  "INR",
  "AED",
];

// GET: Fetch latest cached forex rates
export async function GET(request: NextRequest) {
  const base = request.nextUrl.searchParams.get("base")?.toUpperCase() || "USD";
  const target = request.nextUrl.searchParams.get("target")?.toUpperCase();
  const pair = request.nextUrl.searchParams.get("pair")?.toUpperCase();

  try {
    if (pair) {
      const rate = await prisma.forexRate.findUnique({
        where: { pair },
      });
      return NextResponse.json({ rate });
    }

    if (target) {
      const rate = await prisma.forexRate.findUnique({
        where: { pair: `${base}${target}` },
      });
      return NextResponse.json({ rate });
    }

    const rates = await prisma.forexRate.findMany({
      where: { base },
      orderBy: { target: "asc" },
    });
    return NextResponse.json({ base, rates });
  } catch (error) {
    console.error("[ForexRates] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch forex rates" }, { status: 500 });
  }
}

// POST: Harvest latest forex rates from Frankfurter API (ECB data)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch latest rates from Frankfurter API relative to USD base
    const response = await fetch("https://api.frankfurter.app/latest?base=USD", {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Frankfurter API returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      base: string;
      date: string;
      rates: Record<string, number>;
    };

    const results = [];

    // 2. Iterate rates and update DB / logs
    for (const [currency, rateVal] of Object.entries(data.rates)) {
      if (!TRACKED_CURRENCIES.includes(currency)) continue;

      const pairKey = `USD${currency}`;

      // Upsert current exchange rate
      const current = await prisma.forexRate.upsert({
        where: { pair: pairKey },
        update: { rate: rateVal },
        create: {
          pair: pairKey,
          base: "USD",
          target: currency,
          rate: rateVal,
        },
      });

      // Write to history
      await prisma.forexRateHistory.create({
        data: {
          pair: pairKey,
          rate: rateVal,
        },
      });

      results.push(current);
    }

    // 3. Prune history older than 30 days to keep db clean
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pruned = await prisma.forexRateHistory.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    return NextResponse.json({
      success: true,
      updated: results.length,
      pruned: pruned.count,
      base: "USD",
      rates: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ForexRates] Harvest POST error:", error);
    return NextResponse.json(
      { error: "Harvest failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
