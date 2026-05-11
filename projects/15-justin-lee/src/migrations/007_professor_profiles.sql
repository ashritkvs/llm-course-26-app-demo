-- Phase 3: professor profile storage and version history
-- Stores the active workspace-level profile plus immutable historical snapshots.

create table if not exists public.professor_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  topic_distribution jsonb not null default '{}'::jsonb,
  question_type_distribution jsonb not null default '{}'::jsonb,
  difficulty_profile jsonb not null default '{}'::jsonb,
  exam_structure_profile jsonb not null default '{}'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists professor_profiles_workspace_id_idx
  on public.professor_profiles(workspace_id);

drop trigger if exists set_professor_profiles_updated_at on public.professor_profiles;
create trigger set_professor_profiles_updated_at
before update on public.professor_profiles
for each row execute function public.set_updated_at();

create table if not exists public.professor_profile_versions (
  id uuid primary key default gen_random_uuid(),
  professor_profile_id uuid not null references public.professor_profiles(id) on delete cascade,
  version integer not null check (version >= 1),
  topic_distribution jsonb not null default '{}'::jsonb,
  question_type_distribution jsonb not null default '{}'::jsonb,
  difficulty_profile jsonb not null default '{}'::jsonb,
  exam_structure_profile jsonb not null default '{}'::jsonb,
  evidence_summary jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now(),
  unique (professor_profile_id, version)
);

create index if not exists professor_profile_versions_profile_id_idx
  on public.professor_profile_versions(professor_profile_id);

create index if not exists professor_profile_versions_profile_version_idx
  on public.professor_profile_versions(professor_profile_id, version desc);

alter table public.professor_profiles enable row level security;
alter table public.professor_profile_versions enable row level security;

drop policy if exists "professor_profiles_select_own" on public.professor_profiles;
create policy "professor_profiles_select_own"
on public.professor_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = professor_profiles.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "professor_profiles_insert_own" on public.professor_profiles;
create policy "professor_profiles_insert_own"
on public.professor_profiles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = professor_profiles.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "professor_profiles_update_own" on public.professor_profiles;
create policy "professor_profiles_update_own"
on public.professor_profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = professor_profiles.workspace_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = professor_profiles.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "professor_profiles_delete_own" on public.professor_profiles;
create policy "professor_profiles_delete_own"
on public.professor_profiles
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = professor_profiles.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "professor_profile_versions_select_own" on public.professor_profile_versions;
create policy "professor_profile_versions_select_own"
on public.professor_profile_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.professor_profiles pp
    join public.workspaces w on w.id = pp.workspace_id
    where pp.id = professor_profile_versions.professor_profile_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "professor_profile_versions_insert_own" on public.professor_profile_versions;
create policy "professor_profile_versions_insert_own"
on public.professor_profile_versions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.professor_profiles pp
    join public.workspaces w on w.id = pp.workspace_id
    where pp.id = professor_profile_versions.professor_profile_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "professor_profile_versions_update_own" on public.professor_profile_versions;
create policy "professor_profile_versions_update_own"
on public.professor_profile_versions
for update
to authenticated
using (
  exists (
    select 1
    from public.professor_profiles pp
    join public.workspaces w on w.id = pp.workspace_id
    where pp.id = professor_profile_versions.professor_profile_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.professor_profiles pp
    join public.workspaces w on w.id = pp.workspace_id
    where pp.id = professor_profile_versions.professor_profile_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "professor_profile_versions_delete_own" on public.professor_profile_versions;
create policy "professor_profile_versions_delete_own"
on public.professor_profile_versions
for delete
to authenticated
using (
  exists (
    select 1
    from public.professor_profiles pp
    join public.workspaces w on w.id = pp.workspace_id
    where pp.id = professor_profile_versions.professor_profile_id
      and w.user_id = auth.uid()
  )
);
