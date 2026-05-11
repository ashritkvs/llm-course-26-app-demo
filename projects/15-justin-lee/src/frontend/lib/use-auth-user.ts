"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabaseClient";

type AuthUserProfile = {
  user: User | null;
  loading: boolean;
  displayName: string | null;
  email: string | null;
  initials: string;
  avatarUrl: string | null;
};

type UserMetadata = {
  name?: string;
  full_name?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar_url?: string;
  picture?: string;
};

function getMetadata(user: User | null): UserMetadata {
  if (!user || typeof user.user_metadata !== "object" || user.user_metadata === null) {
    return {};
  }

  return user.user_metadata as UserMetadata;
}

function getDisplayName(user: User | null): string | null {
  const metadata = getMetadata(user);
  const fullName =
    metadata.full_name ??
    metadata.display_name ??
    metadata.name ??
    [metadata.first_name, metadata.last_name].filter(Boolean).join(" ").trim();

  return fullName || user?.email || metadata.email || null;
}

function getEmail(user: User | null): string | null {
  const metadata = getMetadata(user);
  return user?.email ?? metadata.email ?? null;
}

function getInitials(displayName: string | null, email: string | null): string {
  const source = displayName || email || "";
  const words = source
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function getAvatarUrl(user: User | null): string | null {
  const metadata = getMetadata(user);
  return metadata.avatar_url ?? metadata.picture ?? null;
}

export function useAuthUser(): AuthUserProfile {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        setUser(null);
      } else {
        setUser(data.session?.user ?? null);
      }
      setLoading(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return useMemo(() => {
    const displayName = getDisplayName(user);
    const email = getEmail(user);

    return {
      user,
      loading,
      displayName,
      email,
      initials: getInitials(displayName, email),
      avatarUrl: getAvatarUrl(user),
    };
  }, [loading, user]);
}
