import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSummary } from "@/lib/summary";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await prisma.newsSummary.deleteMany({});
  const fresh = await getOrCreateSummary();
  return NextResponse.json({ deleted: deleted.count, summary: fresh });
}

export async function GET() {
  const summary = await getOrCreateSummary();

  if (!summary) {
    return NextResponse.json({ summary: null }, { status: 200 });
  }

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
