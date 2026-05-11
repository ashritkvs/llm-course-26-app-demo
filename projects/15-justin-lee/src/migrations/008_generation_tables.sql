-- Phase 4: Generation and Exam tables
-- Creates generation_requests, generated_exams, and generated_questions.

create table public.generation_requests (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    request_type varchar not null,
    scope_constraints jsonb not null default '{}'::jsonb,
    generation_config jsonb not null default '{}'::jsonb,
    status varchar not null default 'queued',
    created_at timestamp with time zone not null default now(),
    constraint generation_requests_request_type_check
        check (request_type in ('practice_set', 'simulated_exam', 'targeted_regeneration')),
    constraint generation_requests_status_check
        check (status in ('queued', 'running', 'completed', 'failed'))
);

create table public.generated_exams (
    id uuid primary key default gen_random_uuid(),
    generation_request_id uuid not null references public.generation_requests(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    title varchar not null,
    exam_mode varchar not null,
    format_type varchar not null,
    rendered_artifact_path varchar,
    created_at timestamp with time zone not null default now(),
    constraint generated_exams_exam_mode_check
        check (exam_mode in ('practice', 'exam', 'targeted_practice')),
    constraint generated_exams_format_type_check
        check (format_type in ('mcq', 'frq', 'mixed'))
);

create table public.generated_questions (
    id uuid primary key default gen_random_uuid(),
    generated_exam_id uuid not null references public.generated_exams(id) on delete cascade,
    question_order integer not null,
    question_text text not null,
    question_type varchar not null,
    difficulty_label varchar,
    topic_label varchar,
    answer_key text,
    explanation text,
    created_at timestamp with time zone not null default now(),
    constraint generated_questions_question_type_check
        check (question_type in ('mcq', 'frq', 'calculation', 'proof'))
);

-- Indexes for common lookups
create index idx_generation_requests_workspace_id on public.generation_requests(workspace_id);
create index idx_generated_exams_workspace_id on public.generated_exams(workspace_id);
create index idx_generated_exams_generation_request_id on public.generated_exams(generation_request_id);
create index idx_generated_questions_generated_exam_id on public.generated_questions(generated_exam_id);

-- Row-level security policies (same pattern as migrations/003_rls_policies.sql)

alter table public.generation_requests enable row level security;
alter table public.generated_exams enable row level security;
alter table public.generated_questions enable row level security;

-- generation_requests: scoped to workspace owner

drop policy if exists "generation_requests_select_own" on public.generation_requests;
create policy "generation_requests_select_own"
on public.generation_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = generation_requests.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generation_requests_insert_own" on public.generation_requests;
create policy "generation_requests_insert_own"
on public.generation_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = generation_requests.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generation_requests_update_own" on public.generation_requests;
create policy "generation_requests_update_own"
on public.generation_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = generation_requests.workspace_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = generation_requests.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generation_requests_delete_own" on public.generation_requests;
create policy "generation_requests_delete_own"
on public.generation_requests
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = generation_requests.workspace_id
      and w.user_id = auth.uid()
  )
);

-- generated_exams: scoped to workspace owner

drop policy if exists "generated_exams_select_own" on public.generated_exams;
create policy "generated_exams_select_own"
on public.generated_exams
for select
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = generated_exams.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generated_exams_insert_own" on public.generated_exams;
create policy "generated_exams_insert_own"
on public.generated_exams
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = generated_exams.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generated_exams_update_own" on public.generated_exams;
create policy "generated_exams_update_own"
on public.generated_exams
for update
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = generated_exams.workspace_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = generated_exams.workspace_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generated_exams_delete_own" on public.generated_exams;
create policy "generated_exams_delete_own"
on public.generated_exams
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = generated_exams.workspace_id
      and w.user_id = auth.uid()
  )
);

-- generated_questions: scoped via parent generated_exam's workspace owner

drop policy if exists "generated_questions_select_own" on public.generated_questions;
create policy "generated_questions_select_own"
on public.generated_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.generated_exams ge
    join public.workspaces w on w.id = ge.workspace_id
    where ge.id = generated_questions.generated_exam_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generated_questions_insert_own" on public.generated_questions;
create policy "generated_questions_insert_own"
on public.generated_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.generated_exams ge
    join public.workspaces w on w.id = ge.workspace_id
    where ge.id = generated_questions.generated_exam_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generated_questions_update_own" on public.generated_questions;
create policy "generated_questions_update_own"
on public.generated_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.generated_exams ge
    join public.workspaces w on w.id = ge.workspace_id
    where ge.id = generated_questions.generated_exam_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.generated_exams ge
    join public.workspaces w on w.id = ge.workspace_id
    where ge.id = generated_questions.generated_exam_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "generated_questions_delete_own" on public.generated_questions;
create policy "generated_questions_delete_own"
on public.generated_questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.generated_exams ge
    join public.workspaces w on w.id = ge.workspace_id
    where ge.id = generated_questions.generated_exam_id
      and w.user_id = auth.uid()
  )
);
