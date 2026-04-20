import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

const PAY_TO = "0xE083DEc32098F00F0972a8B258ce4414dcF1ca2d";

// Free, keyless, v2-compatible. Supports Base; no Celo (no public v2
// facilitator supports Celo as of 2026-04).
const FACILITATOR_URL = "https://facilitator.payai.network";

let cached: x402ResourceServer | null = null;

export function getX402Server(): x402ResourceServer {
  if (cached) return cached;
  const server = new x402ResourceServer(
    new HTTPFacilitatorClient({ url: FACILITATOR_URL }),
  );
  registerExactEvmScheme(server);
  cached = server;
  return server;
}

export const PRO_FEED_PAYMENT_CONFIG = {
  accepts: [
    {
      scheme: "exact" as const,
      price: "$0.005",
      network: "eip155:8453" as const,
      payTo: PAY_TO,
    },
  ],
  description: "Paginated crypto news feed — 20 articles per page with sentiment scores",
  mimeType: "application/json",
};
