-- Phase 5 fix: add points_possible column to generated_questions
-- The grading service reads points_possible from generated_questions to
-- determine the rubric weight for each question. This column was omitted
-- from the original 008 migration.
-- Default of 1.0 matches the fallback constant in grader.py
-- (_DEFAULT_POINTS_POSSIBLE = 1.0).

alter table public.generated_questions
    add column points_possible numeric not null default 1.0;
