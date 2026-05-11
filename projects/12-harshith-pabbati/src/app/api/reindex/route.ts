import { revalidatePath } from 'next/cache';

import { indexDatasource } from '@/lib/index-datasource';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgId, slug, ids } = await request.json();

  if (!orgId || !slug) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify the authenticated user is a member of the requested organization
  const { data: membership, error: memberError } = await supabase
    .from('member')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (memberError || !membership) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const serviceClient = await createServiceClient();

  let sourcesQuery = serviceClient
    .from('datasource')
    .select('id, url, organization_id')
    .eq('organization_id', orgId);

  if (ids?.length) {
    sourcesQuery = sourcesQuery.in('id', ids);
  }

  const { data: sources, error: fetchError } = await sourcesQuery;
  if (fetchError)
    return Response.json({ error: String(fetchError) }, { status: 500 });
  if (!sources?.length)
    return Response.json({ count: 0, succeeded: 0, failed: 0 });

  let deleteQuery = serviceClient.from('section').delete();
  if (ids?.length) {
    deleteQuery = deleteQuery.in('datasource_id', ids);
  } else {
    deleteQuery = deleteQuery.eq('organization_id', orgId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError)
    return Response.json({ error: String(deleteError) }, { status: 500 });

  let succeeded = 0;
  let failed = 0;
  for (const source of sources) {
    const result = await indexDatasource(source);
    if (result.ok) {
      succeeded++;
    } else {
      failed++;
      console.error(`Failed to reindex datasource ${source.id} (${source.url}):`, result.error);
    }
  }

  revalidatePath(`/org/${slug}/admin`);
  return Response.json({ count: sources.length, succeeded, failed });
}
