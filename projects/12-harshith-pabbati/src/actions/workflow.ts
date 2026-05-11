'use server';

import { revalidatePath } from 'next/cache';

import { createServerClient } from '@/lib/supabase/server';
import type {
  Workflow,
  WorkflowStep,
  WorkflowTrigger,
} from '@/lib/workflow-types';

function toWorkflow(row: {
  id: string;
  created_at: string;
  organization_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger: unknown;
  steps: unknown;
}): Workflow {
  return {
    ...row,
    trigger: row.trigger as WorkflowTrigger,
    steps: ((row.steps as WorkflowStep[]) ?? []),
  };
}

export async function getWorkflows(organizationId: string) {
  const supabase = await createServerClient();
  return supabase
    .from('workflow')
    .select()
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
}

// Throws on error – suitable for use as a TanStack Query queryFn.
export async function fetchWorkflows(organizationId: string): Promise<Workflow[]> {
  const { data, error } = await getWorkflows(organizationId);
  if (error) throw error;
  return (data ?? []).map(toWorkflow);
}

export async function createWorkflow(
  organizationId: string,
  workflow: {
    name: string;
    description?: string;
    trigger: WorkflowTrigger;
    steps: WorkflowStep[];
  },
  slug: string
) {
  const supabase = await createServerClient();
  const result = await supabase
    .from('workflow')
    .insert({
      organization_id: organizationId,
      name: workflow.name,
      description: workflow.description || null,
      enabled: true,
      trigger: workflow.trigger as never,
      steps: workflow.steps as never,
    })
    .select()
    .single();

  if (!result.error) revalidatePath(`/org/${slug}/workflows`);
  return result;
}

export async function updateWorkflow(
  id: string,
  updates: {
    name?: string;
    description?: string | null;
    enabled?: boolean;
    trigger?: WorkflowTrigger;
    steps?: WorkflowStep[];
  },
  slug: string
) {
  const supabase = await createServerClient();
  const result = await supabase
    .from('workflow')
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.enabled !== undefined && { enabled: updates.enabled }),
      ...(updates.trigger !== undefined && { trigger: updates.trigger as never }),
      ...(updates.steps !== undefined && { steps: updates.steps as never }),
    })
    .eq('id', id)
    .select()
    .single();

  if (!result.error) revalidatePath(`/org/${slug}/workflows`);
  return result;
}

export async function deleteWorkflow(id: string, slug: string) {
  const supabase = await createServerClient();
  const result = await supabase.from('workflow').delete().eq('id', id);
  if (!result.error) revalidatePath(`/org/${slug}/workflows`);
  return result;
}

export async function toggleWorkflow(
  id: string,
  enabled: boolean,
  slug: string
) {
  const supabase = await createServerClient();
  const result = await supabase
    .from('workflow')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();

  if (!result.error) revalidatePath(`/org/${slug}/workflows`);
  return result;
}
