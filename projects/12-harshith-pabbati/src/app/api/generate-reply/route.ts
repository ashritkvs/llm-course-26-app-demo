import { createServiceClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const { id } = await request.json();

  const supabase = await createServiceClient();
  const { data: record, error } = await supabase
    .from('email')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: true }), { status: 500 });
  }

  // Fire webhook request and wait for completion to ensure it's processed
  try {
    const webhookResponse = await fetch(`${origin}/api/webhooks/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record }),
    });

    if (!webhookResponse.ok) {
      console.error('Webhook failed:', await webhookResponse.text());
    }
  } catch (error) {
    console.error('Webhook request failed:', error);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
