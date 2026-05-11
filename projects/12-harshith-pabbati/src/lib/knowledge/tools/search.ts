import { tool } from 'ai';
import { z } from 'zod';

import { KnowledgeClient, SectionResult } from '../client';

function formatSections(sections: SectionResult[]): string {
  return sections
    .map(
      (s, i) =>
        `[Section ${i + 1}]${s.heading ? ` ${s.heading}` : ''}\n${s.content}`
    )
    .join('\n\n---\n\n');
}

/**
 * Creates the `search` tool — full-text search across all knowledge base
 * sections. Analogous to running `grep -r "<keyword>" .` in a file tree.
 */
export function createSearchTool(client: KnowledgeClient) {
  return tool({
    description:
      'Search the knowledge base for sections containing a specific keyword or phrase. ' +
      'Use this to locate exact terms, product names, error codes, or configuration keys. ' +
      'Prefer this over guessing — search first, then answer.',
    inputSchema: z.object({
      keyword: z.string().describe('The keyword or phrase to search for.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe('Maximum number of matching sections to return (1–20).'),
    }),
    execute: async ({ keyword, limit }: { keyword: string; limit: number }) => {
      try {
        const sections = await client.search(keyword, limit);
        if (!sections.length) {
          return {
            sections: [],
            count: 0,
            message: `No sections found for "${keyword}".`,
          };
        }
        return {
          sections: sections.map((s) => ({
            heading: s.heading,
            content: s.content,
          })),
          count: sections.length,
          formatted: formatSections(sections),
        };
      } catch (err) {
        console.error('[knowledge/search] error:', err);
        return { sections: [], count: 0, message: 'Search failed.' };
      }
    },
  });
}
