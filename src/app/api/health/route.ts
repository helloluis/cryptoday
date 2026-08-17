// Machine-readable health for the monitor — see https://o.b11.dev/integrate.
//
// cryptoday fails quietly in two directions: the news harvest can stop while
// the site keeps serving yesterday's articles perfectly well, and the price
// feeds can freeze while still rendering a number that looks current. Neither
// throws. Both are what this endpoint exists to notice.
//
// Two rules that read as bugs and are not:
//   1. An unhealthy app still answers HTTP 200 — the body carries the verdict.
//      A non-200 is reserved for "this endpoint itself is broken".
//   2. Nothing defaults to ok. An empty check list, or a section whose query
//      throws, reports down.
//
// Every threshold below is calibrated against observed behaviour rather than
// guessed: articles land every ~0.2h, summaries on a clean 4.0h cadence, and
// ~21 of 28 known sources produce on any given day.
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type HealthState = "ok" | "warn" | "down";

interface Check {
  key: string;
  label: string;
  state: HealthState;
  detail: string;
  value?: number;
  since?: string;
}

const RANK: Record<HealthState, number> = { ok: 0, warn: 1, down: 2 };
const HOUR = 3_600_000;

function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

const hoursSince = (d: Date | null | undefined): number | null =>
  d ? (Date.now() - d.getTime()) / HOUR : null;

/** Turn a thrown query into a `down` check rather than a 500. */
async function guard(
  key: string,
  label: string,
  produce: () => Promise<Check[]>,
): Promise<Check[]> {
  try {
    return await produce();
  } catch (err) {
    return [
      {
        key: `${key}.error`,
        label,
        state: "down",
        detail: `Health query failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    ];
  }
}

async function articleChecks(): Promise<Check[]> {
  const since24h = new Date(Date.now() - 24 * HOUR);

  const [newest, count24h, bySource] = await Promise.all([
    prisma.article.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    }),
    prisma.article.count({ where: { fetchedAt: { gt: since24h } } }),
    prisma.article.groupBy({
      by: ["sourceSlug"],
      where: { fetchedAt: { gt: since24h } },
    }),
  ]);

  const age = hoursSince(newest?.fetchedAt);
  const checks: Check[] = [];

  checks.push({
    key: "articles.freshness",
    label: "Article harvest",
    state: age === null || age > 8 ? "down" : age > 3 ? "warn" : "ok",
    detail:
      age === null
        ? "No articles have ever been harvested."
        : age > 3
          ? `Newest article is ${age.toFixed(1)}h old — the harvest has stalled.`
          : "Harvesting normally.",
    value: age === null ? undefined : Math.round(age * 10) / 10,
    ...(age !== null && age > 3 && newest
      ? { since: newest.fetchedAt.toISOString() }
      : {}),
  });

  checks.push({
    key: "articles.volume24h",
    label: "Articles in 24h",
    state: count24h === 0 ? "down" : count24h < 50 ? "warn" : "ok",
    detail:
      count24h === 0
        ? "Nothing harvested in 24 hours."
        : `${count24h} articles in the last 24 hours.`,
    value: count24h,
  });

  // How many feeds are producing, not which ones. Per-source checks would be
  // permanently noisy: several outlets here legitimately publish only every
  // two or three days, so a uniform staleness threshold would mark them dead
  // forever. A collapse in the *count* is the signal that something systemic
  // broke.
  const active = bySource.length;
  checks.push({
    key: "sources.active24h",
    label: "Sources producing",
    state: active < 5 ? "down" : active < 12 ? "warn" : "ok",
    detail:
      active < 12
        ? `Only ${active} sources produced anything in 24h — usually around 21.`
        : `${active} sources produced articles in the last 24 hours.`,
    value: active,
  });

  return checks;
}

/**
 * The sentiment backlog. This is the same failure that took out Sentigen's
 * scorer: an LLM path stops working, nothing throws, and unscored rows simply
 * pile up looking exactly like "nothing to score".
 */
async function sentimentCheck(): Promise<Check[]> {
  const [unscored, oldest] = await Promise.all([
    prisma.article.count({ where: { sentimentScore: null } }),
    prisma.article.findFirst({
      where: { sentimentScore: null },
      orderBy: { fetchedAt: "asc" },
      select: { fetchedAt: true },
    }),
  ]);

  if (unscored === 0) {
    return [
      {
        key: "articles.sentiment",
        label: "Sentiment scoring",
        state: "ok",
        detail: "Everything is scored.",
        value: 0,
      },
    ];
  }

  const age = hoursSince(oldest?.fetchedAt) ?? 0;
  return [
    {
      key: "articles.sentiment",
      label: "Sentiment scoring",
      state: age > 24 ? "down" : unscored > 100 ? "warn" : "ok",
      detail:
        age > 24
          ? `${unscored} unscored, oldest ${Math.floor(age)}h — the scorer is not draining the queue.`
          : `${unscored} waiting to be scored.`,
      value: unscored,
      ...(age > 24 && oldest ? { since: oldest.fetchedAt.toISOString() } : {}),
    },
  ];
}

/** Digest generation — observed to run on a clean 4-hour cadence. */
async function summaryCheck(): Promise<Check[]> {
  const newest = await prisma.newsSummary.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const age = hoursSince(newest?.createdAt);

  return [
    {
      key: "summary.latest",
      label: "News digest",
      state: age === null || age > 10 ? "down" : age > 6 ? "warn" : "ok",
      detail:
        age === null
          ? "No digest has ever been generated."
          : age > 6
            ? `Newest digest is ${age.toFixed(1)}h old — they normally run every 4h.`
            : "Generating on schedule.",
      value: age === null ? undefined : Math.round(age * 10) / 10,
      ...(age !== null && age > 6 && newest
        ? { since: newest.createdAt.toISOString() }
        : {}),
    },
  ];
}

/**
 * Price feeds. A frozen price is worse than a missing one — the UI renders it
 * with no indication it is hours old.
 *
 * The two markets need different thresholds, and this is the part that would
 * otherwise page every single weekend. Crypto trades continuously, so an hour
 * of staleness is already suspicious. Forex closes Friday evening and reopens
 * Sunday evening, a ~48h gap that is completely normal — so its thresholds sit
 * beyond a full weekend and still catch a feed that is genuinely dead by
 * Monday. Without a market calendar, tolerant-but-honest beats clever.
 */
async function priceChecks(): Promise<Check[]> {
  const [crypto, forex] = await Promise.all([
    prisma.cryptoPrice.findFirst({
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true, symbol: true },
    }),
    prisma.forexRate.findFirst({
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true, pair: true },
    }),
  ]);

  const cryptoAge = hoursSince(crypto?.updatedAt);
  const forexAge = hoursSince(forex?.updatedAt);

  return [
    {
      key: "prices.crypto",
      label: "Crypto prices",
      state: cryptoAge === null || cryptoAge > 8 ? "down" : cryptoAge > 2 ? "warn" : "ok",
      detail:
        cryptoAge === null
          ? "No crypto prices stored at all."
          : cryptoAge > 2
            ? `Stalest symbol (${crypto?.symbol}) is ${cryptoAge.toFixed(1)}h old.`
            : "Updating normally.",
      value: cryptoAge === null ? undefined : Math.round(cryptoAge * 10) / 10,
      ...(cryptoAge !== null && cryptoAge > 2 && crypto
        ? { since: crypto.updatedAt.toISOString() }
        : {}),
    },
    {
      key: "prices.forex",
      label: "Forex rates",
      state: forexAge === null || forexAge > 80 ? "down" : forexAge > 50 ? "warn" : "ok",
      detail:
        forexAge === null
          ? "No forex rates stored at all."
          : forexAge > 50
            ? `Stalest pair (${forex?.pair}) is ${forexAge.toFixed(1)}h old — beyond a normal weekend close.`
            : "Updating normally (weekend closes are expected).",
      value: forexAge === null ? undefined : Math.round(forexAge * 10) / 10,
      ...(forexAge !== null && forexAge > 50 && forex
        ? { since: forex.updatedAt.toISOString() }
        : {}),
    },
  ];
}

export async function GET(request: Request) {
  // Fail closed — the body carries source names, counts and error strings.
  const expected = process.env.MONITOR_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "MONITOR_TOKEN is not configured" },
      { status: 503 },
    );
  }

  const presented =
    request.headers.get("x-monitor-token")?.trim() ||
    new URL(request.url).searchParams.get("token")?.trim() ||
    "";

  if (!presented || !secretsMatch(presented, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await Promise.all([
    guard("articles", "Article harvest", articleChecks),
    guard("articles.sentiment", "Sentiment scoring", sentimentCheck),
    guard("summary", "News digest", summaryCheck),
    guard("prices", "Price feeds", priceChecks),
  ]);
  const checks = groups.flat();

  // An empty list is the absence of evidence, not health.
  const status: HealthState = checks.length
    ? checks.reduce<HealthState>(
        (worst, c) => (RANK[c.state] > RANK[worst] ? c.state : worst),
        "ok",
      )
    : "down";

  return NextResponse.json(
    {
      app: "cryptoday",
      status,
      generatedAt: new Date().toISOString(),
      checks: checks.length
        ? checks
        : [
            {
              key: "health.empty",
              label: "Health checks",
              state: "down" as const,
              detail: "No checks were produced.",
            },
          ],
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
