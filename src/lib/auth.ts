import { prisma } from "./db";

export async function validateApiKey(key: string | null): Promise<boolean> {
  if (!key) return false;

  const apiKey = await prisma.apiKey.findUnique({
    where: { key, active: true },
  });

  return !!apiKey;
}

export async function getApiKey(key: string | null) {
  if (!key) return null;

  return prisma.apiKey.findUnique({
    where: { key, active: true },
  });
}
