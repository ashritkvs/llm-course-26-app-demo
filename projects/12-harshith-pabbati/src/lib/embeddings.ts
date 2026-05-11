import { embed, embedMany } from 'ai';

import { embeddingModel } from '@/lib/ai';

export const EMBEDDING_DIMENSIONS = 768;

/** Number of texts embedded per API call when using generateEmbeddingsInBatches. */
const EMBEDDING_BATCH_SIZE = 50;

/** Maximum retry attempts on rate-limit (429) responses. */
const RETRY_MAX_ATTEMPTS = 4;

/** Base delay in ms for exponential back-off; doubles on each attempt. */
const RETRY_BASE_DELAY_MS = 1000;

/** Delay in ms between consecutive embedding batches to stay within API quota. */
const INTER_BATCH_DELAY_MS = 500;

const providerOptions = {
  google: { outputDimensionality: EMBEDDING_DIMENSIONS },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const err = error as Record<string, unknown>;
  if (err?.status === 429 || err?.statusCode === 429) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('quota exceeded')
    );
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === RETRY_MAX_ATTEMPTS - 1) {
        throw error;
      }
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `Embedding rate limit hit; retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_MAX_ATTEMPTS})`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * Serialise an embedding vector into the string format expected by pgvector
 * (e.g. `[0.1,0.2,0.3]`).
 */
export function serializeEmbedding(values: number[]): string {
  return `[${values.join(',')}]`;
}

/**
 * Generate an embedding vector for a single text input.
 * Retries automatically on rate-limit errors with exponential back-off.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await withRetry(() =>
    embed({
      model: embeddingModel,
      value: text,
      providerOptions,
    })
  );
  return embedding;
}

/**
 * Generate embedding vectors for multiple text inputs in a single request.
 * Retries automatically on rate-limit errors with exponential back-off.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await withRetry(() =>
    embedMany({
      model: embeddingModel,
      values: texts,
      providerOptions,
    })
  );
  return embeddings;
}

/**
 * Generate embeddings for a potentially large array of texts by splitting into
 * batches of EMBEDDING_BATCH_SIZE. A short delay between batches reduces the
 * chance of hitting per-minute quota limits. Each batch already retries on
 * rate-limit errors via generateEmbeddings.
 */
export async function generateEmbeddingsInBatches(
  texts: string[]
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await generateEmbeddings(batch);
    results.push(...batchEmbeddings);
    // Throttle between batches to stay within per-minute API quota.
    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }
  return results;
}
