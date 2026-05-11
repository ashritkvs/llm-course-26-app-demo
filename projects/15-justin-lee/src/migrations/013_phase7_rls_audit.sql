-- Phase 7: RLS audit follow-up
-- Completes missing CRUD policy coverage identified during the Phase 7 security review.

-- users: complete self-service CRUD policy coverage
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "users_delete_own" on public.users;
create policy "users_delete_own"
on public.users
for delete
to authenticated
using (auth.uid() = id);

-- submission_answers: complete update/delete coverage via submission -> workspace ownership
drop policy if exists "submission_answers_update_own" on public.submission_answers;
create policy "submission_answers_update_own"
on public.submission_answers
for update
to authenticated
using (
    exists (
        select 1
        from public.submissions s
        join public.workspaces w on w.id = s.workspace_id
        where s.id = submission_answers.submission_id
          and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.submissions s
        join public.workspaces w on w.id = s.workspace_id
        where s.id = submission_answers.submission_id
          and w.user_id = auth.uid()
    )
);

drop policy if exists "submission_answers_delete_own" on public.submission_answers;
create policy "submission_answers_delete_own"
on public.submission_answers
for delete
to authenticated
using (
    exists (
        select 1
        from public.submissions s
        join public.workspaces w on w.id = s.workspace_id
        where s.id = submission_answers.submission_id
          and w.user_id = auth.uid()
    )
);

-- grading_results: complete delete coverage via submission_answer -> submission -> workspace
drop policy if exists "grading_results_delete_own" on public.grading_results;
create policy "grading_results_delete_own"
on public.grading_results
for delete
to authenticated
using (
    exists (
        select 1
        from public.submission_answers sa
        join public.submissions s on s.id = sa.submission_id
        join public.workspaces w on w.id = s.workspace_id
        where sa.id = grading_results.submission_answer_id
          and w.user_id = auth.uid()
    )
);

-- error_classifications: complete update coverage via grading_result -> submission_answer -> submission -> workspace
drop policy if exists "error_classifications_update_own" on public.error_classifications;
create policy "error_classifications_update_own"
on public.error_classifications
for update
to authenticated
using (
    exists (
        select 1
        from public.grading_results gr
        join public.submission_answers sa on sa.id = gr.submission_answer_id
        join public.submissions s on s.id = sa.submission_id
        join public.workspaces w on w.id = s.workspace_id
        where gr.id = error_classifications.grading_result_id
          and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.grading_results gr
        join public.submission_answers sa on sa.id = gr.submission_answer_id
        join public.submissions s on s.id = sa.submission_id
        join public.workspaces w on w.id = s.workspace_id
        where gr.id = error_classifications.grading_result_id
          and w.user_id = auth.uid()
    )
);
