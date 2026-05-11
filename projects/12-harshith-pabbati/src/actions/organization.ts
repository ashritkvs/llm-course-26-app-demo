'use server';

import { cache } from 'react';
import { revalidatePath } from 'next/cache';

import { slugify } from '@/lib/slug';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

import { getUser } from './auth';

// Cached so the layout, generateMetadata, and page component all share a
// single Supabase round-trip for the same slug within one request.
const getOrganizationBySlugCached = cache(async (slug: string) => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .select(
      'id, name, onboarding, inbound_email, support_email, autopilot_enabled, autopilot_threshold, tone_policy'
    )
    .match({ slug })
    .single();
  return { data, error };
});

// Cached so multiple callers within the same render share one DB round-trip.
const getOrganizationCached = cache(async (id: string) => {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .select()
    .match({ id })
    .single();
  return { data, error };
});

export async function getOrganizations() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('organization').select();
  if (error) return [];
  return data;
}

export async function getOrganization(id: string) {
  return getOrganizationCached(id);
}

export async function getOrganizationBySlug(slug: string) {
  return getOrganizationBySlugCached(slug);
}

export async function updateAutopilotSettings(
  id: string,
  {
    autopilot_enabled,
    autopilot_threshold,
  }: { autopilot_enabled: boolean; autopilot_threshold: number }
) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .update({ autopilot_enabled, autopilot_threshold })
    .eq('id', id)
    .select('autopilot_enabled, autopilot_threshold')
    .single();
  return { data, error };
}

export async function updateTonePolicy(id: string, tone_policy: string | null) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .update({ tone_policy })
    .eq('id', id)
    .select('id, tone_policy')
    .single();
  revalidatePath(`/org`);
  return { data, error };
}

export async function createOrganization({
  name,
  support_email,
}: {
  name: string;
  support_email: string;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await getUser();

  if (!user?.id) {
    throw new Error('User not found');
  }
  const { data, error } = await supabase
    .from('organization')
    .insert({
      name,
      slug: slugify(name),
      support_email,
      inbound_email: `${crypto.randomUUID()}@inbound.answerify.dev`,
      created_by: user.id,
      onboarding: { step: 'email-forwarding', hasOnboarded: false },
    })
    .select()
    .single();

  if (error) return { data, error };

  const { error: memberError } = await supabase
    .from('member')
    .insert({
      organization_id: data.id,
      user_id: user.id,
      role: 2,
    })
    .single();
  if (memberError) return { data: null, error: memberError };

  revalidatePath('/dashboard');
  return { data, error };
}

export async function updateOrganization(
  id: string,
  { name, support_email }: { name: string; support_email: string }
) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .update({ name, slug: slugify(name), support_email })
    .eq('id', id)
    .select()
    .single();

  if (!error && data?.slug) {
    revalidatePath(`/org/${data.slug}`);
    revalidatePath('/dashboard');
  }

  return { data, error };
}

export async function deleteOrganization(id: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .delete()
    .match({ id });
  return { data, error };
}

export async function getOrganizationEmail(slug: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('organization')
    .select('inbound_email')
    .eq('slug', slug)
    .single();
  return { data, error };
}

export async function inviteMember(
  orgId: string,
  { email, role }: { email: string; role: string }
) {
  const serviceSupabase = await createServiceClient();

  // Paginate through auth users in small batches and stop as soon as the
  // target email is found, instead of loading up to 1000 users at once.
  let foundUserId: string | undefined;
  let page = 1;
  const perPage = 50;
  while (!foundUserId) {
    const { data } = await serviceSupabase.auth.admin.listUsers({
      page,
      perPage,
    });
    const match = data.users.find((u) => u.email === email);
    if (match) {
      foundUserId = match.id;
      break;
    }
    // Stop if this is the last page: either the API signals no next page via
    // the Link header, or fewer records than requested were returned.
    const nextPage = 'nextPage' in data ? data.nextPage : null;
    if (!nextPage || data.users.length < perPage) break;
    page = nextPage;
  }

  if (!foundUserId)
    return { data: null, error: new Error('We can not find the user') };

  const supabase = await createServerClient();
  return await supabase
    .from('member')
    .insert({
      organization_id: orgId,
      user_id: foundUserId,
      role: parseInt(role),
    })
    .select()
    .single();
}
