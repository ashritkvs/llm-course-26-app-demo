'use server';

import { cache } from 'react';

import { UserAttributes } from '@supabase/supabase-js';

import { getGravatar } from '@/lib/gravatar';
import { createServerClient } from '@/lib/supabase/server';

// Cached so multiple server components in the same render (e.g. Header and
// Sidebar) share a single Supabase auth round-trip.
const getUserCached = cache(async () => {
  const supabase = await createServerClient();
  return await supabase.auth.getUser();
});

export async function getUser() {
  return getUserCached();
}

export async function signInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const supabase = await createServerClient();
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signUpWithPassword({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const supabase = await createServerClient();
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=/onboarding`,
      data: {
        full_name: name,
        avatar_url: getGravatar(email),
      },
    },
  });
}

export async function forgotPassword({ email }: { email: string }) {
  const supabase = await createServerClient();
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/reset-password`,
  });
}

export async function updateUser(options: UserAttributes) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await getUser();
  return await supabase.auth.updateUser({
    ...options,
    data: {
      ...user?.user_metadata,
      ...options?.data,
    },
  });
}

export async function updateOnboardingStep(
  slug: string,
  {
    hasOnboarded,
    step,
  }: {
    hasOnboarded: boolean;
    step: 'email-forwarding' | 'data-sources' | 'configurations';
  }
) {
  const supabase = await createServerClient();
  return await supabase
    .from('organization')
    .update({ onboarding: { hasOnboarded, step } })
    .match({ slug })
    .single();
}

export async function signOut({
  scope = 'local',
}: {
  scope?: 'global' | 'local' | 'others' | undefined;
} = {}) {
  const supabase = await createServerClient();
  return await supabase.auth.signOut({ scope });
}
