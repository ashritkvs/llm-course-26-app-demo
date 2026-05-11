-- Phase 2: embedding tracking for Chroma-backed chunk indexing
-- Tracks which chunk rows were pushed into the vector store and with which model.

create table if not exists public.chunk_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references public.chunks(chunk_id) on delete cascade,
  vector_store_id varchar not null unique,
  vector_store_collection varchar not null,
  embedding_model varchar not null,
  created_at timestamp not null default now()
);

create index if not exists chunk_embeddings_chunk_id_idx
  on public.chunk_embeddings(chunk_id);

create index if not exists chunk_embeddings_collection_idx
  on public.chunk_embeddings(vector_store_collection);

alter table public.chunk_embeddings enable row level security;

drop policy if exists "chunk_embeddings_select_own" on public.chunk_embeddings;
create policy "chunk_embeddings_select_own"
on public.chunk_embeddings
for select
to authenticated
using (
  exists (
    select 1
    from public.chunks c
    join public.documents d on d.id = c.document_id
    join public.workspaces w on w.id = d.workspace_id
    where c.chunk_id = chunk_embeddings.chunk_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "chunk_embeddings_insert_own" on public.chunk_embeddings;
create policy "chunk_embeddings_insert_own"
on public.chunk_embeddings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.chunks c
    join public.documents d on d.id = c.document_id
    join public.workspaces w on w.id = d.workspace_id
    where c.chunk_id = chunk_embeddings.chunk_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "chunk_embeddings_update_own" on public.chunk_embeddings;
create policy "chunk_embeddings_update_own"
on public.chunk_embeddings
for update
to authenticated
using (
  exists (
    select 1
    from public.chunks c
    join public.documents d on d.id = c.document_id
    join public.workspaces w on w.id = d.workspace_id
    where c.chunk_id = chunk_embeddings.chunk_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chunks c
    join public.documents d on d.id = c.document_id
    join public.workspaces w on w.id = d.workspace_id
    where c.chunk_id = chunk_embeddings.chunk_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "chunk_embeddings_delete_own" on public.chunk_embeddings;
create policy "chunk_embeddings_delete_own"
on public.chunk_embeddings
for delete
to authenticated
using (
  exists (
    select 1
    from public.chunks c
    join public.documents d on d.id = c.document_id
    join public.workspaces w on w.id = d.workspace_id
    where c.chunk_id = chunk_embeddings.chunk_id
      and w.user_id = auth.uid()
  )
);
