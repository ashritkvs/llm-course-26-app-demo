import { generateText, stepCountIs } from 'ai';
import { codeBlock } from 'common-tags';

import { textModel } from '@/lib/ai';
import { URL_CONTEXT_FALLBACK_CONFIDENCE } from '@/lib/autopilot';
import { generateEmbedding, serializeEmbedding } from '@/lib/embeddings';
import { createKnowledge } from '@/lib/knowledge';
import { parseLLMJSON } from '@/lib/parse-llm-json';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/sandbox
 *
 * Runs the full grounded-answer pipeline for a user-supplied question without
 * persisting anything to the database. Used by the Test Sandbox page so that
 * org admins can preview how the AI would respond to a real customer email,
 * including full confidence breakdown and matched knowledge base sections.
 *
 * Body: { orgId: string; question: string; subject?: string }
 * Response: {
 *   html: string;
 *   confidence: number;
 *   vectorConfidence: number;
 *   modelConfidence: number;
 *   citations: string[];
 *   sections: Array<{ content: string; similarity: number; datasourceUrl?: string }>;
 * } | { error: string }
 */

/* -------------------------------------------------------------------------- */
/*                                  UTILITIES                                 */
/* -------------------------------------------------------------------------- */

function computeVectorConfidence(similarities: number[]): number {
  if (!similarities.length) return 0;
  const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  return Math.min(0.99, Math.max(0, avg));
}

function blendConfidence(
  vectorConfidence: number,
  modelConfidence: number
): number {
  return Math.min(
    0.99,
    Math.max(0, vectorConfidence * 0.5 + modelConfidence * 0.5)
  );
}

/** Similarity assigned to neighbor sections fetched for context expansion (not vector-matched themselves). */
const NEIGHBOR_SIMILARITY = 0;

/** Validates a UUID string before interpolating it into a Supabase filter expression. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------------------------------------------------------------- */
/*                        SINGLE PASS GROUNDED ANSWER                         */
/* -------------------------------------------------------------------------- */

async function runGroundedAnswerAgent({
  subject,
  question,
  retrievedContext,
  tonePolicy,
  supabase,
  organizationId,
}: {
  subject: string;
  question: string;
  retrievedContext: string;
  tonePolicy?: string | null;
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  organizationId: string;
}) {
  const { tools } = createKnowledge({ supabase, organizationId });

  const systemPrompt = codeBlock`
    You are a grounded customer support AI.

    RULES:
    - Base your answer on the provided context sections.
    - If the provided context is insufficient to fully answer the question,
      use the available knowledge base tools to search for more information
      before composing your response.
    - Do NOT invent information beyond what the context or tool results support.
    - NEVER include apologies, disclaimers, or notes about what the
      context does NOT cover. Only include information that IS supported.
    - Output valid JSON only — no explanation, no markdown fences.

    Return one of three statuses:

    1. Fully answerable — context covers the entire question:
    { "status": "ANSWER", "html": "<p>...</p>", "confidence": 0.0 to 1.0 }

    2. Partially answerable — context covers some but not all of the question.
       Provide ONLY the supported parts (no apologies or disclaimers):
    { "status": "PARTIAL", "html": "<p>...</p>", "confidence": 0.0 to 1.0 }

    3. Context is entirely irrelevant — nothing useful can be said:
    { "status": "NO_INFORMATION", "confidence": 0 }
  `;

  const { text } = await generateText({
    model: textModel,
    temperature: 0.5,
    maxOutputTokens: 2000,
    system: systemPrompt,
    tools,
    stopWhen: stepCountIs(5),
    prompt: `
      Subject: ${subject}

      Customer question:
      ${question}

      Retrieved knowledge base sections:
      ${retrievedContext}

      Tone policy:
      ${tonePolicy ?? 'Friendly, clear, and professional'}
    `,
  });

  try {
    return parseLLMJSON(text);
  } catch (err) {
    console.error('[sandbox] Failed to parse LLM JSON response:', err, '\nRaw text:', text);
    return { status: 'NO_INFORMATION', confidence: 0, html: null };
  }
}

/* -------------------------------------------------------------------------- */
/*                                   HANDLER                                  */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { orgId, question, subject = 'Preview' } = body ?? {};

  if (!orgId || !question) {
    return new Response(
      JSON.stringify({ error: 'orgId and question are required' }),
      { status: 400 }
    );
  }

  const supabase = await createServerClient();

  const [{ data: datasources }, { data: org }] = await Promise.all([
    supabase.from('datasource').select('id, url').eq('organization_id', orgId),
    supabase
      .from('organization')
      .select('tone_policy')
      .eq('id', orgId)
      .single(),
  ]);

  const tonePolicy = org?.tone_policy ?? null;
  const questionText = `${subject}\n${question}`;

  /* -------------------------- VECTOR RETRIEVAL --------------------------- */

  const matchedSections: Array<{
    content: string;
    datasource_id: string;
    heading: string | null;
    id: string;
    position: number;
    similarity: number;
  }> = [];

  if (datasources && datasources.length > 0) {
    const embedding = await generateEmbedding(questionText);
    if (embedding.length > 0) {
      const { data } = await supabase.rpc('match_sections', {
        embedding: serializeEmbedding(embedding),
        match_threshold: 0.1,
        p_organization_id: orgId,
        match_count: 8,
      });
      if (data) matchedSections.push(...data);
    }
  }

  // Expand context by fetching immediate neighbors (position ± 1) of each
  // matched section so the LLM has surrounding context at chunk boundaries.
  if (matchedSections.length > 0) {
    const matchedIds = new Set(matchedSections.map((s) => s.id));

    // Build a single OR-filter covering all (datasource_id, position) neighbor pairs
    // to avoid N individual round-trips. datasource_id values are validated against
    // a UUID regex before interpolation as a defense-in-depth measure.
    const neighborFilter = matchedSections
      .flatMap((s) => {
        if (!UUID_REGEX.test(s.datasource_id)) return [];
        return [s.position - 1, s.position + 1]
          .filter((pos) => pos >= 0)
          .map(
            (pos) =>
              `and(datasource_id.eq.${s.datasource_id},position.eq.${pos})`
          );
      })
      .join(',');

    if (neighborFilter) {
      const { data: neighborData } = await supabase
        .from('section')
        .select('id, datasource_id, content, heading, position')
        .or(neighborFilter);

      const seenIds = new Set(matchedIds);
      for (const n of neighborData ?? []) {
        if (!seenIds.has(n.id)) {
          seenIds.add(n.id);
          matchedSections.push({ ...n, similarity: NEIGHBOR_SIMILARITY });
        }
      }
    }

    // Sort by datasource then position for coherent in-order context blocks
    matchedSections.sort((a, b) => {
      if (a.datasource_id !== b.datasource_id)
        return a.datasource_id.localeCompare(b.datasource_id);
      return a.position - b.position;
    });
  }

  const vectorConfidence = computeVectorConfidence(
    matchedSections.filter((s) => s.similarity > 0).map((s) => s.similarity)
  );
  const retrievedContext = matchedSections
    .map((s) => s.content)
    .join('\n\n---\n\n');

  const citations =
    datasources
      ?.filter((d) => matchedSections.some((s) => s.datasource_id === d.id))
      .map((d) => d.url) ?? [];

  const sections = matchedSections.map((s) => ({
    content: s.content,
    similarity: s.similarity,
    datasourceUrl: datasources?.find((d) => d.id === s.datasource_id)?.url,
  }));

  if (!retrievedContext.trim()) {
    return new Response(
      JSON.stringify({
        html: '<p>No relevant information found in the knowledge base for this question.</p>',
        confidence: 0,
        vectorConfidence: 0,
        modelConfidence: 0,
        citations: [],
        sections: [],
      }),
      { status: 200 }
    );
  }

  /* ------------------------ GROUNDED ANSWER AGENT ------------------------ */

  const answerResult = await runGroundedAnswerAgent({
    subject,
    question,
    retrievedContext,
    tonePolicy,
    supabase,
    organizationId: orgId,
  });

  if (answerResult.status === 'NO_INFORMATION') {
    return new Response(
      JSON.stringify({
        html: '<p>The AI was unable to generate a reply based on the available knowledge base content.</p>',
        confidence: 0,
        vectorConfidence,
        modelConfidence: 0,
        partial: false,
        citations: [],
        sections,
      }),
      { status: 200 }
    );
  }

  const isPartial = answerResult.status === 'PARTIAL';
  const modelConfidence = answerResult.confidence ?? 0;
  const finalConfidence = blendConfidence(
    vectorConfidence || URL_CONTEXT_FALLBACK_CONFIDENCE,
    modelConfidence
  );

  return new Response(
    JSON.stringify({
      html: answerResult.html,
      confidence: finalConfidence,
      vectorConfidence,
      modelConfidence,
      partial: isPartial,
      citations,
      sections,
    }),
    { status: 200 }
  );
}
