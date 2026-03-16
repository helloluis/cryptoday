import OpenAI from "openai";
import { prisma } from "./db";
import * as fs from "fs";
import * as path from "path";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

const LOGOS_DIR = path.join(process.cwd(), "public", "logos");

// Brands we already have hardcoded logos for — skip these
const KNOWN_BRANDS = new Set([
  "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "xrp", "ripple",
  "cardano", "ada", "bnb", "dogecoin", "doge", "polkadot", "dot",
  "avalanche", "avax", "chainlink", "link", "uniswap", "uni",
  "polygon", "matic", "tether", "usdt", "usdc", "usd coin",
  "litecoin", "ltc", "tron", "trx", "aave", "near", "sui",
  "stellar", "xlm", "cosmos", "atom", "monero", "xmr", "aptos", "apt",
  "arbitrum", "arb", "optimism", "op", "filecoin", "fil", "hedera", "hbar",
  "injective", "inj", "algorand", "algo", "internet computer", "icp",
  "vechain", "vet", "kaspa", "kas", "maker", "mkr", "theta",
  "mantle", "mnt", "sei", "worldcoin", "wld", "stacks", "stx",
  "celestia", "tia", "lido", "ldo", "ondo", "pepe",
  "the graph", "grt", "fetch.ai", "fet",
  "coinbase", "binance", "opensea", "okx", "kucoin",
  "robinhood", "circle", "blockchain.com", "paypal", "stripe", "revolut", "uphold",
]);

interface LogoSearchResult {
  brand: string;
  svgUrl: string | null;
  keywords: string[];
}

/**
 * Use Qwen with web search to find an SVG logo URL for a brand.
 */
async function searchForLogo(brand: string): Promise<LogoSearchResult> {
  try {
    const response = await client.chat.completions.create({
      model: "qwen3.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a helper that finds SVG logo download URLs for cryptocurrency and blockchain brands. Given a brand name, search the web and find a direct URL to an SVG logo file for that brand.

Preferred sources (in order):
1. cryptologos.cc — URL pattern: https://cryptologos.cc/logos/{name}-{ticker}-logo.svg
2. SimpleIcons GitHub — URL pattern: https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/{slug}.svg
3. The brand's official GitHub repo or press kit
4. svgporn.com or similar SVG logo collections

Also provide 2-4 lowercase keywords/tickers that match this brand in news article titles.

Respond with ONLY valid JSON (no markdown, no code fences):
{"svgUrl":"https://...direct-link-to.svg","keywords":["keyword1","keyword2"]}

If you cannot find an SVG URL, respond: {"svgUrl":null,"keywords":["keyword1","keyword2"]}`,
        },
        {
          role: "user",
          content: `Find an SVG logo for: ${brand}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
      // @ts-expect-error DashScope extension for web search
      enable_search: true,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        brand,
        svgUrl: parsed.svgUrl || null,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [brand.toLowerCase()],
      };
    } catch {
      console.error(`[LogoFinder] Failed to parse response for "${brand}":`, raw);
      return { brand, svgUrl: null, keywords: [brand.toLowerCase()] };
    }
  } catch (error) {
    console.error(`[LogoFinder] API error for "${brand}":`, error instanceof Error ? error.message : error);
    return { brand, svgUrl: null, keywords: [brand.toLowerCase()] };
  }
}

/**
 * Download an SVG from a URL and save it to public/logos/.
 * Returns the filename on success, null on failure.
 */
async function downloadSvg(url: string, brand: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "CryptoDay-LogoFinder/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[LogoFinder] HTTP ${response.status} downloading ${url}`);
      return null;
    }

    const text = await response.text();

    // Validate it's actually an SVG
    if (!text.includes("<svg")) {
      console.error(`[LogoFinder] Not an SVG: ${url}`);
      return null;
    }

    const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `${slug}-logo.svg`;
    const filepath = path.join(LOGOS_DIR, filename);

    // Don't overwrite existing files
    if (fs.existsSync(filepath)) {
      return filename;
    }

    // Add fill="white" to SVGs that have no fill attribute (SimpleIcons style)
    // so they render visibly on dark backgrounds
    let svgContent = text;
    if (!svgContent.includes("fill=") && !svgContent.includes("fill:")) {
      svgContent = svgContent.replace("<svg ", '<svg fill="white" ');
    }

    fs.writeFileSync(filepath, svgContent, "utf-8");
    console.log(`[LogoFinder] Saved logo: ${filename}`);
    return filename;
  } catch (error) {
    console.error(`[LogoFinder] Download error for ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Attempt to find and download a logo for a brand.
 * Registers it in the BrandLogo table on success.
 */
export async function discoverLogo(brand: string): Promise<{ found: boolean; filename?: string }> {
  const brandLower = brand.toLowerCase().trim();

  // Skip if it's a known hardcoded brand
  if (KNOWN_BRANDS.has(brandLower)) {
    return { found: false };
  }

  // Check if we already have it in the DB
  const existing = await prisma.brandLogo.findUnique({ where: { brand: brandLower } });
  if (existing) {
    return { found: true, filename: existing.filename };
  }

  // Search for a logo URL using Qwen web search
  const result = await searchForLogo(brand);

  if (!result.svgUrl) {
    // Store a "not found" entry so we don't keep searching
    await prisma.brandLogo.create({
      data: {
        brand: brandLower,
        keywords: result.keywords,
        filename: "",
        source: "auto-notfound",
      },
    }).catch(() => {}); // ignore unique constraint race
    return { found: false };
  }

  // Download the SVG
  const filename = await downloadSvg(result.svgUrl, brandLower);

  if (!filename) {
    return { found: false };
  }

  // Register in DB
  await prisma.brandLogo.create({
    data: {
      brand: brandLower,
      keywords: result.keywords,
      filename,
      source: "auto",
    },
  }).catch(() => {}); // ignore unique constraint race

  return { found: true, filename };
}

/**
 * Scan recent articles for brands/entities that don't have logos yet.
 * Uses Qwen to extract brand names from article titles, then tries to find logos.
 */
export async function discoverMissingLogos(limit = 5): Promise<{ discovered: number; brands: string[] }> {
  // Get recent unique categories that aren't in our known set
  const recentArticles = await prisma.article.findMany({
    where: { analyzed: true },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: { title: true, category: true },
  });

  // Extract unique entities from titles using Qwen
  const titles = recentArticles.map((a) => a.title).slice(0, 50);

  let brandsToSearch: string[] = [];

  try {
    const response = await client.chat.completions.create({
      model: "qwen3.5-flash",
      messages: [
        {
          role: "system",
          content: `You extract brand/company/project names from crypto news headlines. Given a list of headlines, identify crypto projects, exchanges, companies, and protocols that are mentioned. Only return names that are specific brands (not generic terms like "crypto" or "blockchain").

Respond with ONLY a JSON array of unique brand names, lowercase:
["brand1","brand2","brand3"]`,
        },
        {
          role: "user",
          content: titles.join("\n"),
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
    brandsToSearch = JSON.parse(cleaned);
  } catch (error) {
    console.error("[LogoFinder] Failed to extract brands:", error instanceof Error ? error.message : error);
    return { discovered: 0, brands: [] };
  }

  // Filter out brands we already know
  const unknownBrands = brandsToSearch.filter(
    (b) => !KNOWN_BRANDS.has(b.toLowerCase())
  );

  // Check DB for already-attempted brands
  const existingLogos = await prisma.brandLogo.findMany({
    where: { brand: { in: unknownBrands.map((b) => b.toLowerCase()) } },
    select: { brand: true },
  });
  const existingSet = new Set(existingLogos.map((l) => l.brand));

  const newBrands = unknownBrands.filter((b) => !existingSet.has(b.toLowerCase()));

  // Limit how many we discover per run
  const toDiscover = newBrands.slice(0, limit);
  const foundBrands: string[] = [];

  for (const brand of toDiscover) {
    const result = await discoverLogo(brand);
    if (result.found && result.filename) {
      foundBrands.push(brand);
    }
    // Rate limit between searches
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { discovered: foundBrands.length, brands: foundBrands };
}

/**
 * Get all auto-discovered logos from the DB for use in the feed.
 */
export async function getAutoLogos(): Promise<Array<{ brand: string; keywords: string[]; filename: string }>> {
  return prisma.brandLogo.findMany({
    where: {
      source: "auto",
      filename: { not: "" },
    },
    select: { brand: true, keywords: true, filename: true },
  });
}
