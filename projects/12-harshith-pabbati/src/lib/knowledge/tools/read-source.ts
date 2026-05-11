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
 * Creates the `read_source` tool — reads all indexed content sections from a
 * specific datasource URL. Analogous to running `cat <file>` on a document.
 */
export function createReadSourceTool(client: KnowledgeClient) {
  return tool({
    description:
      'Read all indexed content sections from a specific knowledge base source URL. ' +
      'Use this to get the full content of a document when a search result is incomplete ' +
      'or you need to read the surrounding context. ' +
      'Get the URL from list_sources first if you do not already have it.',
    inputSchema: z.object({
      url: z
        .string()
        .url()
        .describe('The datasource URL to read (must match exactly).'),
    }),
    execute: async ({ url }: { url: string }) => {
      try {
        const { sections } = await client.readSource(url);
        if (!sections.length) {
          return {
            sections: [],
            count: 0,
            message: `No indexed content found for "${url}".`,
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
        console.error('[knowledge/read_source] error:', err);
        return {
          sections: [],
          count: 0,
          message: `Could not read source "${url}".`,
        };
      }
    },
  });
}
