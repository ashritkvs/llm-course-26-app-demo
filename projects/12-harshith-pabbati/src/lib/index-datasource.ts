import { generateEmbeddingsInBatches, serializeEmbedding } from '@/lib/embeddings';
import { processMarkdown } from '@/lib/processMarkdown';
import { createServiceClient } from '@/lib/supabase/service';

export type DatasourceRecord = {
  id: string;
  url: string;
  organization_id: string;
};

/**
 * Index a datasource record: fetch its URL, chunk the content, generate
 * embeddings, and store sections in the database.
 *
 * Mutates the datasource row's `status` field directly.
 */
export async function indexDatasource(record: DatasourceRecord) {
  const supabase = await createServiceClient();

  // Validate the URL before using it to construct a fetch request
  let validatedUrl: URL;
  try {
    validatedUrl = new URL(record.url);
    if (validatedUrl.protocol !== 'http:' && validatedUrl.protocol !== 'https:') {
      throw new Error('Only http and https URLs are supported');
    }
  } catch {
    await supabase
      .from('datasource')
      .update({ status: 'error' })
      .eq('id', record.id);
    return { ok: false, error: 'Invalid URL' };
  }

  // Mark as processing
  await supabase
    .from('datasource')
    .update({ status: 'processing' })
    .eq('id', record.id);

  let textContent: string;
  try {
    const response = await fetch(`https://r.jina.ai/${validatedUrl.href}`, {
      headers: {
        'User-Agent': 'Answerify/1.0 (knowledge-base indexer)',
        'X-Return-Format': 'markdown',
      },
    });
    if (!response.ok) {
      throw new Error(`jina.ai returned ${response.status}`);
    }
    textContent = (await response.text()).trim();
  } catch (error) {
    console.error('Failed to fetch datasource URL:', error);
    await supabase
      .from('datasource')
      .update({ status: 'error' })
      .eq('id', record.id);
    return { ok: false, error: 'Failed to fetch URL' };
  }

  if (!textContent) {
    await supabase
      .from('datasource')
      .update({ status: 'ready' })
      .eq('id', record.id);
    return { ok: true, message: 'No content found' };
  }

  const { sections } = processMarkdown(textContent);
  if (sections.length === 0) {
    await supabase
      .from('datasource')
      .update({ status: 'ready' })
      .eq('id', record.id);
    return { ok: true, message: 'No sections produced' };
  }

  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddingsInBatches(sections.map((s) => s.content));
  } catch (error) {
    console.error('Failed to generate embeddings:', error);
    await supabase
      .from('datasource')
      .update({ status: 'error' })
      .eq('id', record.id);
    return { ok: false, error: 'Failed to generate embeddings' };
  }

  const sectionRows = sections.map((s, i) => ({
    datasource_id: record.id,
    organization_id: record.organization_id,
    content: s.content,
    heading: s.heading ?? null,
    position: i,
    embedding: serializeEmbedding(embeddings[i]),
  }));

  const { error: insertError } = await supabase
    .from('section')
    .insert(sectionRows);
  if (insertError) {
    console.error('Failed to insert sections:', insertError);
    await supabase
      .from('datasource')
      .update({ status: 'error' })
      .eq('id', record.id);
    return { ok: false, error: 'Failed to store sections' };
  }

  await supabase
    .from('datasource')
    .update({ status: 'ready' })
    .eq('id', record.id);

  return { ok: true, sections: sections.length };
}
