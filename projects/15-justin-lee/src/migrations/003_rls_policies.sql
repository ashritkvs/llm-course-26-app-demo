-- Phase 1: row-level security policies for app-owned data
-- Enforces that authenticated users can only access rows they own.

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.documents enable row level security;

-- Users: allow reading/updating only your own profile row.
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Workspaces: users can manage only their own rows.
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own"
on public.workspaces
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own"
on public.workspaces
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own"
on public.workspaces
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_delete_own"
on public.workspaces
for delete
to authenticated
using (auth.uid() = user_id);

-- Documents: access is derived from owning the parent workspace.
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
on public.documents
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = documents.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
on public.documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = documents.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
on public.documents
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = documents.workspace_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = documents.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
on public.documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = documents.workspace_id
      and w.user_id = auth.uid()
  )
);
