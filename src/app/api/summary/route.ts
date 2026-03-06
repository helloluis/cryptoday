import { NextResponse } from "next/server";
import { getOrCreateSummary } from "@/lib/summary";

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
