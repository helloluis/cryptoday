import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAX_SEARCHES_PER_KEY = 20;
const VALID_PROVIDERS = ["google", "gnw", "both"];

export async function GET(request: NextRequest) {
  const apiKeyRecord = await getApiKey(request.headers.get("x-api-key"));
  if (!apiKeyRecord) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searches = await prisma.customSearch.findMany({
    where: { apiKeyId: apiKeyRecord.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, query: true, provider: true, active: true, createdAt: true },
  });

  return NextResponse.json({ searches });
}

export async function POST(request: NextRequest) {
  const apiKeyRecord = await getApiKey(request.headers.get("x-api-key"));
  if (!apiKeyRecord) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "Missing 'query' field" }, { status: 400 });
  }

  const query = body.query.trim().slice(0, 200);
  const provider = VALID_PROVIDERS.includes(body.provider) ? body.provider : "google";

  // Check limit
  const count = await prisma.customSearch.count({ where: { apiKeyId: apiKeyRecord.id } });
  if (count >= MAX_SEARCHES_PER_KEY) {
    return NextResponse.json({ error: `Maximum ${MAX_SEARCHES_PER_KEY} searches per API key` }, { status: 400 });
  }

  try {
    const search = await prisma.customSearch.create({
      data: { query, provider, apiKeyId: apiKeyRecord.id },
      select: { id: true, query: true, provider: true, active: true, createdAt: true },
    });
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    // Unique constraint violation
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Search query already exists" }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  const apiKeyRecord = await getApiKey(request.headers.get("x-api-key"));
  if (!apiKeyRecord) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: "Missing 'id' field" }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.customSearch.findFirst({
    where: { id: body.id, apiKeyId: apiKeyRecord.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.query === "string") update.query = body.query.trim().slice(0, 200);
  if (VALID_PROVIDERS.includes(body.provider)) update.provider = body.provider;
  if (typeof body.active === "boolean") update.active = body.active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const search = await prisma.customSearch.update({
      where: { id: body.id },
      data: update,
      select: { id: true, query: true, provider: true, active: true, createdAt: true },
    });
    return NextResponse.json({ search });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Search query already exists" }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const apiKeyRecord = await getApiKey(request.headers.get("x-api-key"));
  if (!apiKeyRecord) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: "Missing 'id' field" }, { status: 400 });
  }

  const deleted = await prisma.customSearch.deleteMany({
    where: { id: body.id, apiKeyId: apiKeyRecord.id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
