import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { validateApiKey } from "@/lib/auth";
import { fetchFeedArticles } from "@/lib/feed";
import { getX402Server, PRO_FEED_PAYMENT_CONFIG } from "@/lib/x402";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

async function handler(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const source = request.nextUrl.searchParams.get("source");
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1"));

  const { articles, total } = await fetchFeedArticles({
    limit: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
    category,
    source,
    apiKeyId: null,
  });

  return NextResponse.json({
    articles,
    meta: {
      total,
      page,
      limit: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}

const paidHandler = withX402(handler, PRO_FEED_PAYMENT_CONFIG, getX402Server());

// API key holders bypass x402; everyone else must pay.
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (await validateApiKey(apiKey)) {
    return handler(request);
  }
  return paidHandler(request);
}
