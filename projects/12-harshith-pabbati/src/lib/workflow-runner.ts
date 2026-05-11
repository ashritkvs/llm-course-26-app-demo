import type { SupabaseClient } from '@supabase/supabase-js';

import type { Tables } from '@/database.types';
import type { WorkflowStep, WorkflowTrigger } from '@/lib/workflow-types';

function matchesTrigger(
  trigger: WorkflowTrigger,
  thread: Tables<'thread'>
): boolean {
  switch (trigger.type) {
    case 'any_email':
      return true;
    case 'subject_contains':
      return (thread.subject ?? '')
        .toLowerCase()
        .includes(trigger.value.toLowerCase());
    case 'sender_domain':
      return (thread.email_from ?? '')
        .toLowerCase()
        .endsWith(`@${trigger.value.toLowerCase()}`);
    case 'has_tag':
      const tags = thread.tags ?? [];
      return tags.some((tag) => tag.toLowerCase() === trigger.value.toLowerCase());
    default:
      return false;
  }
}

async function executeStep(
  supabase: SupabaseClient,
  step: WorkflowStep,
  thread: Tables<'thread'>
): Promise<void> {
  switch (step.type) {
    case 'add_tag': {
      const tag = step.config.tag;
      if (!tag) return;
      const existingTags = thread.tags ?? [];
      if (existingTags.includes(tag)) return;
      await supabase
        .from('thread')
        .update({ tags: [...existingTags, tag] })
        .eq('id', thread.id);
      break;
    }

    case 'escalate': {
      const existingTags = thread.tags ?? [];
      if (existingTags.includes('escalated')) return;
      await supabase
        .from('thread')
        .update({ tags: [...existingTags, 'escalated'] })
        .eq('id', thread.id);
      break;
    }

    case 'auto_reply': {
      const message = step.config.message;
      if (!message) return;
      await supabase.from('reply').insert({
        organization_id: thread.organization_id,
        thread_id: thread.id,
        content: message,
        confidence_score: 1.0,
        citations: [],
        status: 'approved',
      });
      break;
    }

    case 'webhook': {
      const url = step.config.url;
      if (!url) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            thread_id: thread.id,
            subject: thread.subject,
            email_from: thread.email_from,
            organization_id: thread.organization_id,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          console.error(`Webhook ${url} responded with status ${res.status}`);
        }
      } finally {
        clearTimeout(timeout);
      }
      break;
    }
  }
}

export async function runWorkflows(
  supabase: SupabaseClient,
  thread: Tables<'thread'>
): Promise<void> {
  const { data: rows } = await supabase
    .from('workflow')
    .select()
    .eq('organization_id', thread.organization_id)
    .eq('enabled', true);

  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    const trigger = row.trigger as unknown as WorkflowTrigger;
    const steps = (row.steps as unknown as WorkflowStep[]) ?? [];

    if (!matchesTrigger(trigger, thread)) continue;

    for (const step of steps) {
      try {
        await executeStep(supabase, step, thread);
      } catch (err) {
        console.error(`Workflow step "${step.type}" failed:`, err);
      }
    }
  }
}
