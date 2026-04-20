import { prisma } from "./db";

export type FeedArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceSlug: string;
  publishedAt: Date;
  summary: string | null;
  category: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
};

export type FetchFeedParams = {
  limit: number;
  skip?: number;
  category?: string | null;
  source?: string | null;
  apiKeyId?: string | null;
};

export async function fetchFeedArticles(params: FetchFeedParams): Promise<{
  articles: FeedArticle[];
  total: number;
}> {
  const { limit, skip = 0, category, source, apiKeyId } = params;

  const where: Record<string, unknown> = {};
  if (apiKeyId) {
    where.apiKeyId = apiKeyId;
  } else {
    where.analyzed = true;
    where.hidden = false;
    where.apiKeyId = null;
  }
  if (category) where.category = category.toUpperCase();
  if (source) where.sourceSlug = source;

  const overfetch = Math.ceil(limit * 1.5);

  const [rawArticles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: overfetch,
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

  const seen = new Map<string, FeedArticle>();
  for (const article of rawArticles) {
    const key = article.title.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, article);
    } else {
      const existingIsAggregator = existing.source.startsWith("Google News");
      const currentIsAggregator = article.source.startsWith("Google News");
      if (existingIsAggregator && !currentIsAggregator) {
        seen.set(key, article);
      }
    }
  }

  return { articles: [...seen.values()].slice(0, limit), total };
}
