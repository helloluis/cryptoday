import { NextRequest, NextResponse } from "next/server";
import { harvestStaggered, harvestAll } from "@/lib/harvester";
import { analyzeUnprocessed } from "@/lib/analyzer";

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

  const totalAdded = results.reduce((sum, r) => sum + r.added, 0);

  let analyzed = 0;
  if (totalAdded > 0) {
    analyzed = await analyzeUnprocessed(totalAdded + 5);
  }

  // Also analyze any previously unanalyzed articles
  const remainingUnanalyzed = await analyzeUnprocessed(20);
  analyzed += remainingUnanalyzed;

  return NextResponse.json({
    results,
    totalAdded,
    analyzed,
    timestamp: new Date().toISOString(),
  });
}
