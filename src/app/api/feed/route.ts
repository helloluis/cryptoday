import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const category = request.nextUrl.searchParams.get("category");
  const source = request.nextUrl.searchParams.get("source");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1");

  const isAuthenticated = await validateApiKey(apiKey);
  const limit = isAuthenticated ? 50 : 10;
  const skip = isAuthenticated ? (page - 1) * limit : 0;

  const where: Record<string, unknown> = { analyzed: true };
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
    response.notice = "This is a free sample feed limited to 10 articles. Pass an x-api-key header for full access.";
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
