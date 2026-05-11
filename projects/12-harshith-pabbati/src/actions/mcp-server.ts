'use server';

import { revalidatePath } from 'next/cache';

import { createServerClient } from '@/lib/supabase/server';

export async function getMcpServers(organizationId: string) {
  const supabase = await createServerClient();
  return await supabase
    .from('mcp_server')
    .select()
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
}

// Throws on error – suitable for use as a TanStack Query queryFn.
export async function fetchMcpServers(organizationId: string) {
  const { data, error } = await getMcpServers(organizationId);
  if (error) throw error;
  return data ?? [];
}

export async function addMcpServer(
  organizationId: string,
  {
    name,
    url,
    api_key,
    description,
  }: {
    name: string;
    url: string;
    api_key?: string;
    description?: string;
  },
  slug: string
) {
  const supabase = await createServerClient();
  const result = await supabase
    .from('mcp_server')
    .insert({
      organization_id: organizationId,
      name,
      url,
      api_key: api_key || null,
      description: description || null,
    })
    .select()
    .single();

  if (!result.error) {
    revalidatePath(`/org/${slug}`);
  }

  return result;
}

export async function deleteMcpServer(id: string, slug: string) {
  const supabase = await createServerClient();
  const result = await supabase.from('mcp_server').delete().eq('id', id);

  if (!result.error) {
    revalidatePath(`/org/${slug}`);
  }

  return result;
}
