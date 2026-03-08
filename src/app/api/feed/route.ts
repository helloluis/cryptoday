import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey, getApiKey } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const category = request.nextUrl.searchParams.get("category");
  const source = request.nextUrl.searchParams.get("source");
  const scope = request.nextUrl.searchParams.get("scope");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1");

  const isAuthenticated = await validateApiKey(apiKey);
  const skipParam = parseInt(request.nextUrl.searchParams.get("skip") || "0");
  const limitParam = parseInt(request.nextUrl.searchParams.get("limit") || "0");
  const limit = isAuthenticated ? (limitParam || 50) : Math.min(limitParam || 20, 20);
  const skip = isAuthenticated ? (page > 1 ? (page - 1) * limit : skipParam) : skipParam;

  const where: Record<string, unknown> = {};

  // scope=custom returns only the user's private custom search articles
  if (scope === "custom" && isAuthenticated) {
    const apiKeyRecord = await getApiKey(apiKey);
    where.apiKeyId = apiKeyRecord!.id;
  } else {
    // Default: only show analyzed public articles (no custom search articles)
    where.analyzed = true;
    where.apiKeyId = null;
  }

  if (category) where.category = category.toUpperCase();
  if (source) where.sourceSlug = source;

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip,
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        sourceSlug: true,
        publishedAt: true,
        summary: true,
        category: true,
        sentimentScore: true,
        sentimentLabel: true,
      },
    }),
    prisma.article.count({ where }),
  ]);

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
    response.notice = "Free sample feed limited to 20 articles per page. Pass an x-api-key header for full access.";
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
