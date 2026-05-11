-- Migration 010: Fix grading schema
-- Drops the incorrectly structured Phase 5 tables created by the original
-- 009_submission_grading_tables.sql and recreates them with the correct
-- column names that match backend/models/grading.py exactly.
--
-- Safe to run in development because no real submission data exists yet.
-- Column problems fixed:
--   submissions:         added user_id, submitted_at, overall_score/total_possible
--                        (was total_score/max_score), added updated_at trigger
--   submission_answers:  student_answer → answer_content
--   grading_results:     dropped is_correct boolean, score/max_score/feedback
--                        added correctness_label CHECK, score_value, points_possible,
--                        diagnostic_explanation, concept_label, updated_at trigger
--   error_classifications: added error_type CHECK constraint, made severity nullable

-- ============================================================
-- Drop old tables in reverse FK dependency order
-- ============================================================

drop table if exists public.error_classifications cascade;
drop table if exists public.grading_results         cascade;
drop table if exists public.submission_answers      cascade;
drop table if exists public.submissions             cascade;

-- ============================================================
-- submissions
-- ============================================================

create table public.submissions (
    id                  uuid primary key default gen_random_uuid(),
    workspace_id        uuid not null references public.workspaces(id)      on delete cascade,
    user_id             uuid not null references public.users(id)           on delete cascade,
    generated_exam_id   uuid not null references public.generated_exams(id) on delete cascade,
    status              varchar not null default 'submitted',
    submitted_at        timestamp with time zone,
    overall_score       numeric,
    total_possible      numeric,
    created_at          timestamp with time zone not null default now(),
    updated_at          timestamp with time zone not null default now(),
    constraint submissions_status_check
        check (status in ('submitted', 'grading', 'graded', 'failed'))
);

-- ============================================================
-- submission_answers
-- ============================================================

create table public.submission_answers (
    id                      uuid primary key default gen_random_uuid(),
    submission_id           uuid not null references public.submissions(id)          on delete cascade,
    generated_question_id   uuid not null references public.generated_questions(id)  on delete cascade,
    answer_content          text not null,
    created_at              timestamp with time zone not null default now()
);

-- ============================================================
-- grading_results
-- ============================================================

create table public.grading_results (
    id                      uuid primary key default gen_random_uuid(),
    submission_answer_id    uuid not null references public.submission_answers(id) on delete cascade,
    correctness_label       varchar not null,
    score_value             numeric not null default 0,
    points_possible         numeric not null default 1,
    diagnostic_explanation  text,
    concept_label           varchar,
    created_at              timestamp with time zone not null default now(),
    updated_at              timestamp with time zone not null default now(),
    constraint grading_results_correctness_label_check
        check (correctness_label in ('correct', 'partial', 'incorrect'))
);

-- ============================================================
-- error_classifications
-- ============================================================

create table public.error_classifications (
    id                  uuid primary key default gen_random_uuid(),
    grading_result_id   uuid not null references public.grading_results(id) on delete cascade,
    error_type          varchar not null,
    severity            varchar,
    description         text,
    created_at          timestamp with time zone not null default now(),
    constraint error_classifications_error_type_check
        check (error_type in (
            'wrong_method',
            'formula_misuse',
            'computation_error',
            'interpretation_error',
            'incomplete_reasoning'
        )),
    constraint error_classifications_severity_check
        check (severity is null or severity in ('minor', 'moderate', 'major'))
);

-- ============================================================
-- Indexes on all FK columns
-- ============================================================

create index idx_submissions_workspace_id        on public.submissions(workspace_id);
create index idx_submissions_user_id             on public.submissions(user_id);
create index idx_submissions_generated_exam_id   on public.submissions(generated_exam_id);

create index idx_submission_answers_submission_id          on public.submission_answers(submission_id);
create index idx_submission_answers_generated_question_id  on public.submission_answers(generated_question_id);

create index idx_grading_results_submission_answer_id  on public.grading_results(submission_answer_id);

create index idx_error_classifications_grading_result_id on public.error_classifications(grading_result_id);

-- ============================================================
-- updated_at triggers
-- ============================================================

create trigger set_submissions_updated_at
    before update on public.submissions
    for each row execute function public.set_updated_at();

create trigger set_grading_results_updated_at
    before update on public.grading_results
    for each row execute function public.set_updated_at();

-- ============================================================
-- Row-level security
-- ============================================================

alter table public.submissions           enable row level security;
alter table public.submission_answers    enable row level security;
alter table public.grading_results       enable row level security;
alter table public.error_classifications  enable row level security;

-- submissions: scoped to workspace owner

drop policy if exists "submissions_select_own" on public.submissions;
create policy "submissions_select_own"
on public.submissions for select to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = submissions.workspace_id and w.user_id = auth.uid()
    )
);

drop policy if exists "submissions_insert_own" on public.submissions;
create policy "submissions_insert_own"
on public.submissions for insert to authenticated
with check (
    exists (
        select 1 from public.workspaces w
        where w.id = submissions.workspace_id and w.user_id = auth.uid()
    )
);

drop policy if exists "submissions_update_own" on public.submissions;
create policy "submissions_update_own"
on public.submissions for update to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = submissions.workspace_id and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.workspaces w
        where w.id = submissions.workspace_id and w.user_id = auth.uid()
    )
);

drop policy if exists "submissions_delete_own" on public.submissions;
create policy "submissions_delete_own"
on public.submissions for delete to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = submissions.workspace_id and w.user_id = auth.uid()
    )
);

-- submission_answers: scoped via submission → workspace owner

drop policy if exists "submission_answers_select_own" on public.submission_answers;
create policy "submission_answers_select_own"
on public.submission_answers for select to authenticated
using (
    exists (
        select 1
        from public.submissions s
        join public.workspaces w on w.id = s.workspace_id
        where s.id = submission_answers.submission_id and w.user_id = auth.uid()
    )
);

drop policy if exists "submission_answers_insert_own" on public.submission_answers;
create policy "submission_answers_insert_own"
on public.submission_answers for insert to authenticated
with check (
    exists (
        select 1
        from public.submissions s
        join public.workspaces w on w.id = s.workspace_id
        where s.id = submission_answers.submission_id and w.user_id = auth.uid()
    )
);

-- grading_results: scoped via submission_answer → submission → workspace

drop policy if exists "grading_results_select_own" on public.grading_results;
create policy "grading_results_select_own"
on public.grading_results for select to authenticated
using (
    exists (
        select 1
        from public.submission_answers sa
        join public.submissions s on s.id = sa.submission_id
        join public.workspaces  w on w.id = s.workspace_id
        where sa.id = grading_results.submission_answer_id and w.user_id = auth.uid()
    )
);

drop policy if exists "grading_results_insert_own" on public.grading_results;
create policy "grading_results_insert_own"
on public.grading_results for insert to authenticated
with check (
    exists (
        select 1
        from public.submission_answers sa
        join public.submissions s on s.id = sa.submission_id
        join public.workspaces  w on w.id = s.workspace_id
        where sa.id = grading_results.submission_answer_id and w.user_id = auth.uid()
    )
);

drop policy if exists "grading_results_update_own" on public.grading_results;
create policy "grading_results_update_own"
on public.grading_results for update to authenticated
using (
    exists (
        select 1
        from public.submission_answers sa
        join public.submissions s on s.id = sa.submission_id
        join public.workspaces  w on w.id = s.workspace_id
        where sa.id = grading_results.submission_answer_id and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.submission_answers sa
        join public.submissions s on s.id = sa.submission_id
        join public.workspaces  w on w.id = s.workspace_id
        where sa.id = grading_results.submission_answer_id and w.user_id = auth.uid()
    )
);

-- error_classifications: scoped via grading_result → submission_answer → submission → workspace

drop policy if exists "error_classifications_select_own" on public.error_classifications;
create policy "error_classifications_select_own"
on public.error_classifications for select to authenticated
using (
    exists (
        select 1
        from public.grading_results    gr
        join public.submission_answers sa on sa.id = gr.submission_answer_id
        join public.submissions        s  on s.id  = sa.submission_id
        join public.workspaces         w  on w.id  = s.workspace_id
        where gr.id = error_classifications.grading_result_id and w.user_id = auth.uid()
    )
);

drop policy if exists "error_classifications_insert_own" on public.error_classifications;
create policy "error_classifications_insert_own"
on public.error_classifications for insert to authenticated
with check (
    exists (
        select 1
        from public.grading_results    gr
        join public.submission_answers sa on sa.id = gr.submission_answer_id
        join public.submissions        s  on s.id  = sa.submission_id
        join public.workspaces         w  on w.id  = s.workspace_id
        where gr.id = error_classifications.grading_result_id and w.user_id = auth.uid()
    )
);

drop policy if exists "error_classifications_delete_own" on public.error_classifications;
create policy "error_classifications_delete_own"
on public.error_classifications for delete to authenticated
using (
    exists (
        select 1
        from public.grading_results    gr
        join public.submission_answers sa on sa.id = gr.submission_answer_id
        join public.submissions        s  on s.id  = sa.submission_id
        join public.workspaces         w  on w.id  = s.workspace_id
        where gr.id = error_classifications.grading_result_id and w.user_id = auth.uid()
    )
);
