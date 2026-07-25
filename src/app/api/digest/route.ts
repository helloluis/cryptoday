import { NextResponse } from "next/server";
import { getOrCreateSummary } from "@/lib/summary";

// Public digest endpoint for sister apps — same data the homepage shows,
// shaped as a stable API contract. No auth required.
export async function GET() {
  const summary = await getOrCreateSummary();

  if (!summary) {
    return NextResponse.json(
      { digest: null },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  return NextResponse.json(
    {
      digest: {
        summary: summary.summary,
        sentimentScore: summary.sentimentScore,
        sentimentLabel: summary.sentimentLabel,
        articleCount: summary.articleCount,
        periodStart: summary.periodStart,
        periodEnd: summary.periodEnd,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
