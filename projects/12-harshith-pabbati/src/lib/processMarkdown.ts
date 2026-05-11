// @ts-ignore
import { Root, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import { u } from 'unist-builder';

export type Json = Record<
  string,
  string | number | boolean | null | Json[] | { [key: string]: Json }
>;

export type Section = {
  content: string;
  heading?: string;
  part?: number;
  total?: number;
};

export type ProcessedMd = {
  sections: Section[];
};

/**
 * Splits a `mdast` tree into multiple trees based on
 * a predicate function. Will include the splitting node
 * at the beginning of each tree.
 *
 * Useful to split a markdown file into smaller sections.
 */
export function splitTreeBy(
  tree: Root,
  predicate: (node: RootContent) => boolean
) {
  return tree.children.reduce<Root[]>((trees: any, node: any) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree: Root = u('root', [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}

/**
 * Splits a long text string into overlapping chunks of at most `maxChunkSize`
 * characters. Chunk boundaries are snapped to the nearest sentence end
 * (punctuation followed by whitespace) within a look-back window to avoid
 * cutting sentences mid-way. Each chunk after the first overlaps the previous
 * one by `overlapSize` characters to preserve cross-boundary context.
 *
 * Note: The sentence boundary regex (`[.!?]`) intentionally handles common
 * cases. Known limitations: abbreviations (e.g. "Dr.", "Inc.") and ellipses
 * ("...") may trigger false boundaries; these are rare enough not to affect
 * overall retrieval quality.
 */
export function splitIntoChunks(
  text: string,
  maxChunkSize: number,
  overlapSize: number
): string[] {
  if (text.length <= maxChunkSize) return [text];

  // The look-back window is a fraction of the chunk size. Using ¼ balances
  // sentence-boundary search cost against the risk of splitting too early.
  const SENTENCE_SEARCH_WINDOW_RATIO = 0.25;

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChunkSize, text.length);

    // When not at the end of the string, snap the chunk boundary to the last
    // sentence end within the final quarter of the candidate chunk to avoid
    // cutting sentences mid-way. The search window starts after the overlap
    // point (start + overlapSize) so the snapped `end` always leaves room for
    // the next chunk to advance forward.
    if (end < text.length) {
      const lookback = Math.floor(maxChunkSize * SENTENCE_SEARCH_WINDOW_RATIO);
      // The `+ 1` ensures the search window always ends at least 1 character
      // beyond `start`, guaranteeing the next `start = end - overlapSize`
      // moves forward and the loop cannot stall.
      const searchStart = Math.max(start + overlapSize + 1, end - lookback);
      if (searchStart < end) {
        const segment = text.slice(searchStart, end);

        // Find the last sentence-ending punctuation followed by whitespace/newline
        // or the end of the segment.
        let lastBoundary = -1;
        const re = /[.!?](?=\s|$)/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(segment)) !== null) {
          lastBoundary = match.index + 1; // +1 to include the punctuation mark
        }

        if (lastBoundary !== -1) {
          end = searchStart + lastBoundary;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= text.length) break;

    // The next chunk starts `overlapSize` characters before the current end,
    // giving consecutive chunks shared context across the boundary.
    start = end - overlapSize;
  }

  return chunks;
}

/**
 * Splits markdown content by heading into sections.
 * Keeps heading in each chunk.
 *
 * If a section is still greater than `maxSectionLength`, that section
 * is split into overlapping chunks with sentence-boundary snapping so that
 * no sentence is cut mid-way and consecutive chunks share `chunkOverlap`
 * characters of context.
 */
export function processMarkdown(
  content: string,
  maxSectionLength = 5000,
  chunkOverlap = 200
): ProcessedMd {
  const mdTree = fromMarkdown(content);

  if (!mdTree) {
    return {
      sections: [],
    };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading');

  const sections = sectionTrees.flatMap<Section>((tree: any) => {
    const [firstNode] = tree.children;
    const content = toMarkdown(tree);

    const heading =
      firstNode.type === 'heading' ? toString(firstNode) : undefined;

    // Chunk sections if they are too large
    if (content.length > maxSectionLength) {
      const chunks = splitIntoChunks(content, maxSectionLength, chunkOverlap);

      return chunks.map((chunk, i) => ({
        content: chunk,
        heading,
        part: i + 1,
        total: chunks.length,
      }));
    }

    return {
      content,
      heading,
    };
  });

  return {
    sections,
  };
}
