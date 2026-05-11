import { generateEmbeddings, serializeEmbedding } from '@/lib/embeddings';
import { processMarkdown } from '@/lib/processMarkdown';
import { createServiceClient } from '@/lib/supabase/service';

const INTERNAL_KB_URL = 'internal://knowledge-base';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { content } = await request.json();

  const supabase = await createServiceClient();

  const { data: reply, error: fetchError } = await supabase
    .from('reply')
    .select('content, status, organization_id')
    .eq('id', id)
    .single();

  if (fetchError || !reply) {
    return new Response(JSON.stringify({ error: 'Reply not found' }), {
      status: 404,
    });
  }

  // Mark as approved and record whether the human edited the AI draft
  const isPerfect = reply.content === content;
  const { data, error } = await supabase
    .from('reply')
    .update({
      content,
      status: reply.status === 'sent' ? 'sent' : 'approved',
      is_perfect: isPerfect,
      human_content: isPerfect ? null : content,
      learned: false,
    })
    .eq('id', id)
    .select()
    .single();

  // --- Learning Loop ---
  // Store edit log and feed the approved content back into the knowledge base
  // so future vector searches can retrieve it.
  try {
    // Find or create an internal knowledge-base datasource for this org
    let { data: kbSource } = await supabase
      .from('datasource')
      .select('id')
      .eq('organization_id', reply.organization_id)
      .eq('is_internal_kb', true)
      .single();

    if (!kbSource) {
      const { data: newSource } = await supabase
        .from('datasource')
        .insert({
          organization_id: reply.organization_id,
          url: INTERNAL_KB_URL,
          is_internal_kb: true,
        } as never)
        .select('id')
        .single();
      kbSource = newSource;
    }

    if (kbSource) {
      // Chunk the approved content and generate embeddings
      const { sections } = processMarkdown(content);
      if (sections.length > 0) {
        const embeddings = await generateEmbeddings(
          sections.map((s) => s.content)
        );

        const sectionRows = sections.map((s, i) => ({
          datasource_id: kbSource.id,
          organization_id: reply.organization_id,
          content: s.content,
          heading: s.heading ?? null,
          position: i,
          embedding: serializeEmbedding(embeddings[i]),
        }));

        await supabase.from('section').insert(sectionRows as never);
        const { error: learnedError } = await supabase
          .from('reply')
          .update({ learned: true })
          .eq('id', id);
        if (learnedError) {
          console.error('Failed to set learned=true on reply:', learnedError);
        }
      }
    }
  } catch (err) {
    // Learning loop failures should not block the approval response
    console.error('Learning loop failed:', err);
  }

  return new Response(JSON.stringify({ data, error }), { status: 200 });
}
