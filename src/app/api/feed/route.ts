import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, getApiKey } from "@/lib/auth";
import { fetchFeedArticles } from "@/lib/feed";

const FREE_TIER_LIMIT = 5;

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const category = request.nextUrl.searchParams.get("category");
  const source = request.nextUrl.searchParams.get("source");
  const scope = request.nextUrl.searchParams.get("scope");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1");

  const isAuthenticated = await validateApiKey(apiKey);
  const skipParam = parseInt(request.nextUrl.searchParams.get("skip") || "0");
  const limitParam = parseInt(request.nextUrl.searchParams.get("limit") || "0");

  const limit = isAuthenticated
    ? limitParam || 50
    : Math.min(limitParam || FREE_TIER_LIMIT, FREE_TIER_LIMIT);
  const skip = isAuthenticated ? (page > 1 ? (page - 1) * limit : skipParam) : 0;

  let apiKeyId: string | null = null;
  if (scope === "custom" && isAuthenticated) {
    const apiKeyRecord = await getApiKey(apiKey);
    apiKeyId = apiKeyRecord!.id;
  }

  const { articles, total } = await fetchFeedArticles({
    limit,
    skip,
    category,
    source,
    apiKeyId,
  });

  const response: Record<string, unknown> = {
    articles,
    meta: {
      total,
      page: isAuthenticated ? page : 1,
      limit,
      authenticated: isAuthenticated,
    },
  };

  if (!isAuthenticated) {
    response.notice =
      `Free tier limited to ${FREE_TIER_LIMIT} most recent articles. ` +
      `For paginated access to 20 articles per page with sentiment scores, ` +
      `either pay via x402 at /api/feed/pro (USDC on Base) ` +
      `or pass an x-api-key header.`;
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
