import { Database } from '@/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

import { KnowledgeClient, KnowledgeConfig } from './client';
import { createListSourcesTool } from './tools/list-sources';
import { createReadSourceTool } from './tools/read-source';
import { createSearchTool } from './tools/search';

export type {
  KnowledgeConfig,
  KnowledgeClient,
  SectionResult,
  DatasourceResult,
} from './client';

export interface Knowledge {
  /** Low-level Supabase query client for direct access. */
  client: KnowledgeClient;
  /**
   * AI SDK-compatible tools for use with `generateText` / `streamText`.
   *
   * - `search`        — full-text search across all sections (like `grep`)
   * - `list_sources`  — list all datasource URLs (like `ls`)
   * - `read_source`   — read all sections from one URL (like `cat`)
   */
  tools: {
    search: ReturnType<typeof createSearchTool>;
    list_sources: ReturnType<typeof createListSourcesTool>;
    read_source: ReturnType<typeof createReadSourceTool>;
  };
}

/**
 * Create a Knowledge instance backed by Answerify's Supabase knowledge base.
 *
 * Returns a `{ client, tools }` object — pass `knowledge.tools` directly to
 * `generateText` / `streamText` to give the AI model multi-step text search
 * capabilities over the stored content.
 *
 * The tools are intentionally text-based (no vector/embedding search) so the
 * model can explore the knowledge base interactively, similar to running
 * `grep`, `cat`, and `ls` against a file tree.
 *
 * @example
 * ```ts
 * import { createKnowledge } from '@/lib/knowledge'
 * import { generateText, stepCountIs } from 'ai'
 *
 * const knowledge = createKnowledge({ supabase, organizationId })
 *
 * const { text } = await generateText({
 *   model,
 *   tools: knowledge.tools,
 *   stopWhen: stepCountIs(5),
 *   prompt: 'How do I reset my password?',
 * })
 * ```
 */
export function createKnowledge(config: {
  supabase: SupabaseClient<Database>;
  organizationId: string;
}): Knowledge {
  const client = new KnowledgeClient(config as KnowledgeConfig);

  return {
    client,
    tools: {
      search: createSearchTool(client),
      list_sources: createListSourcesTool(client),
      read_source: createReadSourceTool(client),
    },
  };
}
