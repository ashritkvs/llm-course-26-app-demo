import { Tables } from '@/database.types';
import PostalMime from 'postal-mime';

import { detectIntent } from '@/lib/intent-detection';
import { createServiceClient } from '@/lib/supabase/service';
import { runWorkflows } from '@/lib/workflow-runner';

export async function POST(request: Request) {
  const secret = request.headers.get('X-Webhook-Secret');
  if (secret !== process.env.EMAIL_ROUTING_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  const { raw, envelope } = await request.json();

  const rawBuffer = Buffer.from(raw, 'base64');
  const parser = new PostalMime();
  const parsed = await parser.parse(rawBuffer);

  const from = {
    value: [
      {
        address: parsed.from?.address || envelope.from,
        name: parsed.from?.name || '',
      },
    ],
  };
  const subject = parsed.subject || null;
  const text = parsed.text || null;
  const html = parsed.html || null;
  const messageId = parsed.messageId || null;
  const references = parsed.references || null;

  const supabase = await createServiceClient();

  const { data: orgData, error: orgError } = await supabase
    .from('organization')
    .select('id')
    .eq('inbound_email', envelope.to)
    .single();

  if (orgError) {
    return new Response(
      JSON.stringify({ error: 'Failed to find the recipient' }),
      { status: 200 }
    );
  }

  let thread: Tables<'thread'> | null = null;

  if (references) {
    const isArray = Array.isArray(references);
    const { data, error } = await supabase
      .from('thread')
      .select()
      .eq('message_id', isArray ? references[0] : references)
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to find the thread' }),
        { status: 200 }
      );
    }

    thread = data;
  } else {
    const { data, error } = await supabase
      .from('thread')
      .insert({
        organization_id: orgData.id,
        email_from: from.value[0].address as string,
        email_from_name: from.value[0].name,
        subject: subject as string,
        message_id: messageId as string,
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to create thread' }),
        { status: 200 }
      );
    }

    thread = data;
  }

  if (!thread?.id) {
    return new Response(
      JSON.stringify({ error: 'Failed to find the thread' }),
      { status: 200 }
    );
  }

  const { error: emailError } = await supabase
    .from('email')
    .insert({
      organization_id: orgData.id,
      thread_id: thread.id,
      email_from: from.value[0].address,
      email_from_name: from.value[0].name,
      body: html as string,
      cleaned_body: text,
      role: 'user',
    })
    .single();

  if (thread.status === 'closed') {
    await supabase
      .from('thread')
      .update({ status: 'open' })
      .match({ id: thread.id });
  }

  if (emailError) {
    return new Response(JSON.stringify({ error: 'Failed to create email' }), {
      status: 200,
    });
  }

  // Detect intent and assign tags — run in the background so errors don't
  // block the webhook response. Workflows execute after intent tags are applied
  // so that tag-based workflow rules fire on the freshly classified thread.
  (async () => {
    try {
      const intentTags = await detectIntent(
        thread.subject ?? '',
        text ?? subject ?? ''
      );

      let taggedThread: Tables<'thread'> = thread;

      if (intentTags.length > 0) {
        const existingTags = thread.tags ?? [];
        const newTags = [
          ...existingTags,
          ...intentTags.filter((t) => !existingTags.includes(t)),
        ];

        const { data: updated } = await supabase
          .from('thread')
          .update({ tags: newTags })
          .eq('id', thread.id)
          .select()
          .single();

        if (updated) taggedThread = updated;
      }

      await runWorkflows(supabase, taggedThread);
    } catch (err) {
      console.error('Intent detection / workflow runner error:', err);
    }
  })();

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
