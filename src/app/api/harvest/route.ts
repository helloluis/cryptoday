import { NextRequest, NextResponse } from "next/server";
import { harvestStaggered, harvestAll } from "@/lib/harvester";
import { harvestXTimeline } from "@/lib/x-harvester";
import { harvestCustomSearches } from "@/lib/custom-search-harvester";
import { analyzeUnprocessed } from "@/lib/analyzer";
import { getOrCreateSummary, getCurrentPeriodStart } from "@/lib/summary";
import { prisma } from "@/lib/db";

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

  // Harvest X timeline alongside RSS feeds
  const xAdded = await harvestXTimeline();
  results.push({ source: "X Timeline", added: xAdded });

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

  return NextResponse.json({
    results,
    totalAdded,
    analyzed,
    summaryGenerated,
    timestamp: new Date().toISOString(),
  });
}
