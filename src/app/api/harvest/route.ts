import { NextRequest, NextResponse } from "next/server";
import { harvestStaggered, harvestAll } from "@/lib/harvester";
// import { harvestXTimeline } from "@/lib/x-harvester"; // disabled — X API returns 402
import { harvestReddit } from "@/lib/reddit-harvester";
import { harvestFarcaster } from "@/lib/farcaster-harvester";
import { harvestCustomSearches } from "@/lib/custom-search-harvester";
import { analyzeUnprocessed, backfillCuration } from "@/lib/analyzer";
import { getOrCreateSummary, getCurrentPeriodStart } from "@/lib/summary";
import { discoverMissingLogos } from "@/lib/logo-finder";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action");

  if (action === "backfill-curation") {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const result = await backfillCuration(Math.min(limit, 200));
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const batch = typeof body.batch === "number" ? body.batch : null;

  let results;
  if (batch !== null) {
    results = await harvestStaggered(batch % 4);
  } else {
    results = await harvestAll();
  }

  // Harvest social feeds (Reddit + Farcaster)
  const redditAdded = await harvestReddit();
  results.push({ source: "Reddit", added: redditAdded });

  const farcasterAdded = await harvestFarcaster();
  results.push({ source: "Farcaster", added: farcasterAdded });

  // Harvest custom searches for all API keys
  const customResults = await harvestCustomSearches();
  const customAdded = customResults.reduce((s, r) => s + r.added, 0);
  results.push({ source: "Custom Searches", added: customAdded });

  const totalAdded = results.reduce((sum, r) => sum + r.added, 0);

  let analyzed = 0;
  if (totalAdded > 0) {
    analyzed = await analyzeUnprocessed(totalAdded + 5);
  }

  // Also analyze any previously unanalyzed articles
  const remainingUnanalyzed = await analyzeUnprocessed(20);
  analyzed += remainingUnanalyzed;

  // Generate summary if we don't have one for the current period
  let summaryGenerated = false;
  const periodStart = getCurrentPeriodStart();
  const existingSummary = await prisma.newsSummary.findUnique({ where: { periodStart } });
  if (!existingSummary) {
    await getOrCreateSummary();
    summaryGenerated = true;
  }

  // Discover logos for new brands (max 3 per harvest to limit API calls)
  let logosDiscovered = 0;
  try {
    const logoResult = await discoverMissingLogos(3);
    logosDiscovered = logoResult.discovered;
    if (logosDiscovered > 0) {
      console.log(`[Harvest] Discovered ${logosDiscovered} new logos: ${logoResult.brands.join(", ")}`);
    }
  } catch (error) {
    console.error("[Harvest] Logo discovery error:", error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    results,
    totalAdded,
    analyzed,
    summaryGenerated,
    logosDiscovered,
    timestamp: new Date().toISOString(),
  });
}
