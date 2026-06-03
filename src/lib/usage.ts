import { prisma } from "./db";

/** Shape of the `usage` object returned by the OpenAI-compatible API. */
type CompletionUsage =
  | {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    }
  | null
  | undefined;

/**
 * Record token usage for a single LLM call. Logs to stdout (visible in PM2)
 * and persists one row per call to the TokenUsage table.
 *
 * Never throws — usage tracking must not break the harvest/analysis pipeline.
 */
export async function recordUsage(
  operation: string,
  model: string | null | undefined,
  usage: CompletionUsage,
): Promise<void> {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens =
    usage?.total_tokens ?? promptTokens + completionTokens;
  const modelName = model || "unknown";

  console.log(
    `[Usage] ${operation} (${modelName}): ${promptTokens} prompt + ${completionTokens} completion = ${totalTokens} tokens`,
  );

  try {
    await prisma.tokenUsage.create({
      data: {
        operation,
        model: modelName,
        promptTokens,
        completionTokens,
        totalTokens,
      },
    });
  } catch (error) {
    console.error(
      `[Usage] Failed to persist usage for ${operation}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
