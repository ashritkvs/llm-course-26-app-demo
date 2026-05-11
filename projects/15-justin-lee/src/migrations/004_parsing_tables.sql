-- Phase 2: document parsing job tracking and parsed content storage
-- Adds async parsing job state and normalized Markdown output tables.

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  parser_used varchar,
  status varchar not null default 'queued',
  confidence_score double precision,
  error_message text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists document_processing_jobs_document_id_idx
  on public.document_processing_jobs(document_id);
create index if not exists document_processing_jobs_status_idx
  on public.document_processing_jobs(status);

drop trigger if exists set_document_processing_jobs_updated_at on public.document_processing_jobs;
create trigger set_document_processing_jobs_updated_at
before update on public.document_processing_jobs
for each row execute function public.set_updated_at();

create table if not exists public.parsed_documents (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  normalized_content text not null,
  structural_metadata jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);

create index if not exists parsed_documents_document_id_idx
  on public.parsed_documents(document_id);

alter table public.document_processing_jobs enable row level security;
alter table public.parsed_documents enable row level security;

drop policy if exists "document_processing_jobs_select_own" on public.document_processing_jobs;
create policy "document_processing_jobs_select_own"
on public.document_processing_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = document_processing_jobs.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "document_processing_jobs_insert_own" on public.document_processing_jobs;
create policy "document_processing_jobs_insert_own"
on public.document_processing_jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = document_processing_jobs.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "document_processing_jobs_update_own" on public.document_processing_jobs;
create policy "document_processing_jobs_update_own"
on public.document_processing_jobs
for update
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = document_processing_jobs.document_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = document_processing_jobs.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "document_processing_jobs_delete_own" on public.document_processing_jobs;
create policy "document_processing_jobs_delete_own"
on public.document_processing_jobs
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = document_processing_jobs.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "parsed_documents_select_own" on public.parsed_documents;
create policy "parsed_documents_select_own"
on public.parsed_documents
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = parsed_documents.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "parsed_documents_insert_own" on public.parsed_documents;
create policy "parsed_documents_insert_own"
on public.parsed_documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = parsed_documents.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "parsed_documents_update_own" on public.parsed_documents;
create policy "parsed_documents_update_own"
on public.parsed_documents
for update
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = parsed_documents.document_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = parsed_documents.document_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "parsed_documents_delete_own" on public.parsed_documents;
create policy "parsed_documents_delete_own"
on public.parsed_documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    join public.workspaces w on w.id = d.workspace_id
    where d.id = parsed_documents.document_id
      and w.user_id = auth.uid()
  )
);
