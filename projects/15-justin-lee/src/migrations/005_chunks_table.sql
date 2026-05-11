-- Phase 2: semantic chunk storage for parsed documents
-- Stores instructional units extracted from normalized Markdown.

create table if not exists public.chunks (
  chunk_id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  position integer not null,
  chunk_type_label varchar not null default 'section',
  topic_label varchar,
  created_at timestamp not null default now(),
  unique (document_id, position)
);

create index if not exists chunks_document_id_idx
  on public.chunks(document_id);
create index if not exists chunks_type_label_idx
  on public.chunks(chunk_type_label);
create index if not exists chunks_topic_label_idx
  on public.chunks(topic_label);

alter table public.chunks enable row level security;

drop policy if exists "chunks_select_own" on public.chunks;
create policy "chunks_select_own"
on public.chunks
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = chunks.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "chunks_insert_own" on public.chunks;
create policy "chunks_insert_own"
on public.chunks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = chunks.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "chunks_update_own" on public.chunks;
create policy "chunks_update_own"
on public.chunks
for update
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = chunks.document_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = chunks.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "chunks_delete_own" on public.chunks;
create policy "chunks_delete_own"
on public.chunks
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = chunks.document_id
      and w.user_id = auth.uid()
  )
);
