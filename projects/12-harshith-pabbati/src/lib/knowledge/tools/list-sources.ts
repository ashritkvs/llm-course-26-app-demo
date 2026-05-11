import { tool } from 'ai';
import { z } from 'zod';

import { KnowledgeClient } from '../client';

/**
 * Creates the `list_sources` tool — lists all knowledge base datasources for
 * the organization. Analogous to running `ls` on the root of a file tree.
 */
export function createListSourcesTool(client: KnowledgeClient) {
  return tool({
    description:
      'List all knowledge base sources (URLs) that have been indexed for this organization. ' +
      'Call this to discover what topics or documents are available before searching.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const sources = await client.listSources();
        if (!sources.length) {
          return {
            sources: [],
            count: 0,
            message: 'No knowledge base sources are configured.',
          };
        }
        return { sources: sources.map((s) => s.url), count: sources.length };
      } catch (err) {
        console.error('[knowledge/list_sources] error:', err);
        return {
          sources: [],
          count: 0,
          message: 'Could not retrieve source list.',
        };
      }
    },
  });
}
