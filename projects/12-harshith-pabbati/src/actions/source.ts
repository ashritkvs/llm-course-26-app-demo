'use server';

import { cache } from 'react';
import { revalidatePath } from 'next/cache';

import { indexDatasource } from '@/lib/index-datasource';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// Cached so the layout/page and any other server component requesting the same
// org's sources within one render share a single Supabase round-trip.
const getSourcesCached = cache(async (id: string) => {
  const supabase = await createServerClient();
  return await supabase
    .from('datasource')
    .select()
    .match({ organization_id: id });
});

export async function getSources(id: string) {
  return getSourcesCached(id);
}

// Throws on error – suitable for use as a TanStack Query queryFn.
export async function fetchSources(id: string) {
  const { data, error } = await getSourcesCached(id);
  if (error) throw error;
  return data ?? [];
}

export async function setupSources(slug: string, sources: { url: string }[]) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .select('id')
    .match({ slug })
    .single();
  if (error || !data?.id) return { data: null, error };

  const result = await supabase
    .from('datasource')
    .insert(
      sources
        .filter(({ url }) => url)
        .map(({ url }) => ({
          organization_id: data.id,
          url,
          is_internal_kb: true,
        }))
    )
    .select();

  if (!result.error) {
    revalidatePath(`/org/${slug}`);
  }

  return result;
}

export async function deleteSource(id: string, slug: string) {
  const supabase = await createServerClient();
  // Sections are deleted via cascade (datasource_id FK)
  const { error } = await supabase.from('datasource').delete().eq('id', id);
  if (!error) {
    revalidatePath(`/org/${slug}`);
    revalidatePath(`/org/${slug}/admin`);
  }
  return { error };
}

export async function reindexSource(id: string, slug: string) {
  const supabase = await createServiceClient();

  // Fetch the datasource record
  const { data: source, error: fetchError } = await supabase
    .from('datasource')
    .select('id, url, organization_id')
    .eq('id', id)
    .single();
  if (fetchError || !source) return { error: fetchError };

  // Delete existing sections so we start fresh
  await supabase.from('section').delete().eq('datasource_id', id);

  // Re-run the full indexing pipeline
  await indexDatasource(source);

  revalidatePath(`/org/${slug}/admin`);
  return { error: null };
}

export async function reindexSelectedSources(ids: string[], slug: string) {
  if (!ids.length) return { error: null, count: 0, succeeded: 0, failed: 0 };

  const supabase = await createServiceClient();

  // Fetch only the requested datasource records
  const { data: sources, error: fetchError } = await supabase
    .from('datasource')
    .select('id, url, organization_id')
    .in('id', ids);

  if (fetchError)
    return { error: fetchError, count: 0, succeeded: 0, failed: 0 };
  if (!sources?.length)
    return { error: null, count: 0, succeeded: 0, failed: 0 };

  // Drop existing sections for these specific sources
  const { error: deleteError } = await supabase
    .from('section')
    .delete()
    .in('datasource_id', ids);
  if (deleteError)
    return { error: deleteError, count: 0, succeeded: 0, failed: 0 };

  const results = await Promise.allSettled(
    sources.map((source) => indexDatasource(source))
  );

  const succeeded = results.filter(
    (r) => r.status === 'fulfilled' && r.value.ok
  ).length;
  const failed = results.length - succeeded;

  revalidatePath(`/org/${slug}/admin`);
  return { error: null, count: sources.length, succeeded, failed };
}

export async function reindexAllSources(orgId: string, slug: string) {
  const supabase = await createServiceClient();

  // Fetch all datasource records for this org
  const { data: sources, error: fetchError } = await supabase
    .from('datasource')
    .select('id, url, organization_id')
    .eq('organization_id', orgId);

  if (fetchError)
    return { error: fetchError, count: 0, succeeded: 0, failed: 0 };
  if (!sources?.length)
    return { error: null, count: 0, succeeded: 0, failed: 0 };

  // Drop all existing sections for this org at once, then reindex in parallel
  const { error: deleteError } = await supabase
    .from('section')
    .delete()
    .eq('organization_id', orgId);
  if (deleteError)
    return { error: deleteError, count: 0, succeeded: 0, failed: 0 };

  const results = await Promise.allSettled(
    sources.map((source) => indexDatasource(source))
  );

  const succeeded = results.filter(
    (r) => r.status === 'fulfilled' && r.value.ok
  ).length;
  const failed = results.length - succeeded;

  revalidatePath(`/org/${slug}/admin`);
  return { error: null, count: sources.length, succeeded, failed };
}

export type AdminSource = {
  id: string;
  url: string;
  status: string;
  created_at: string;
  organization_id: string;
  is_internal_kb: boolean | null;
  section_count: number;
};

export async function getAdminSources(orgId: string): Promise<AdminSource[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('datasource')
    .select(
      `
      id,
      url,
      status,
      created_at,
      organization_id,
      is_internal_kb,
      section:section(count)
    `
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    url: row.url,
    status: row.status,
    created_at: row.created_at,
    organization_id: row.organization_id,
    is_internal_kb: row.is_internal_kb,
    section_count: row.section?.[0]?.count ?? 0,
  }));
}

export type RecentReply = {
  id: string;
  thread_id: string;
  confidence_score: number;
  status: string;
  is_perfect: boolean | null;
  created_at: string;
};

export async function getRecentReplies(
  orgId: string,
  limit = 20
): Promise<RecentReply[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from('reply')
    .select('id, thread_id, confidence_score, status, is_perfect, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
