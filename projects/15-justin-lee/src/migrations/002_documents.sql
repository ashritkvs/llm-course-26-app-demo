-- Phase 1: documents
-- Matches docs/DB_SCHEMA.md (UUID PKs, snake_case, plural table names)

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type varchar not null,
  file_name varchar not null,
  upload_label varchar,
  file_path varchar not null,
  processing_status varchar not null default 'uploaded',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists documents_workspace_id_idx on public.documents(workspace_id);

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();
