import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

// GET: Fetch latest cached forex rates (quasi-paywalled)
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const isAuthenticated = await validateApiKey(apiKey);

  const base = request.nextUrl.searchParams.get("base")?.toUpperCase() || "USD";
  const target = request.nextUrl.searchParams.get("target")?.toUpperCase();
  const pair = request.nextUrl.searchParams.get("pair")?.toUpperCase();

  try {
    if (pair) {
      if (pair !== "USDPHP" && !isAuthenticated) {
        return NextResponse.json(
          {
            error: "Payment Required",
            notice: "Access to other exchange rates requires an API key. Only USDPHP is available for free.",
          },
          { status: 402 }
        );
      }

      const rate = await prisma.forexRate.findUnique({
        where: { pair },
      });
      return NextResponse.json({ rate });
    }

    if (target) {
      if ((base !== "USD" || target !== "PHP") && !isAuthenticated) {
        return NextResponse.json(
          {
            error: "Payment Required",
            notice: "Access to other exchange rates requires an API key. Only USDPHP is available for free.",
          },
          { status: 402 }
        );
      }

      const rate = await prisma.forexRate.findUnique({
        where: { pair: `${base}${target}` },
      });
      return NextResponse.json({ rate });
    }

    if (isAuthenticated) {
      const rates = await prisma.forexRate.findMany({
        where: { base },
        orderBy: { target: "asc" },
      });
      return NextResponse.json({ base, rates });
    } else {
      const phpRate = await prisma.forexRate.findUnique({
        where: { pair: "USDPHP" },
      });
      return NextResponse.json({
        base: "USD",
        rates: phpRate ? [phpRate] : [],
        notice: "Free tier limited to USDPHP. To unlock 30+ comprehensive fiat currency rates, pass a valid x-api-key header.",
      });
    }
  } catch (error) {
    console.error("[ForexRates] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch forex rates" }, { status: 500 });
  }
}

// POST: Harvest latest forex rates from Frankfurter API (100% comprehensive global currencies)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    for (const [currency, rateVal] of Object.entries(data.rates)) {
      const pairKey = `USD${currency}`;

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

      await prisma.forexRateHistory.create({
        data: {
          pair: pairKey,
          rate: rateVal,
        },
      });

      results.push(current);
    }

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
