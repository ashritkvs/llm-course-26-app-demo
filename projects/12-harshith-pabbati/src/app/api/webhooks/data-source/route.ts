import { indexDatasource } from '@/lib/index-datasource';

/**
 * Webhook triggered when a new datasource row is inserted.
 *
 * 1. Sets status to 'processing'
 * 2. Fetches the URL content as markdown via jina.ai
 * 3. Chunks with processMarkdown (splits by headings)
 * 4. Generates embeddings via the configured embedding model
 * 5. Inserts sections into the `section` table
 * 6. Sets status to 'ready' (or 'error' on failure)
 */
export async function POST(request: Request) {
  const { record } = await request.json();
  const result = await indexDatasource(record);
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
  });
}
