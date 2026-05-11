-- Phase 4 fix: add options column to generated_questions
-- MCQ answer choices were omitted from the original 008 migration.
-- options stores the ordered list of answer-choice strings as a JSONB array
-- (e.g. ["choice A text", "choice B text", "choice C text", "choice D text"]).
-- Non-MCQ questions store an empty array [].

alter table public.generated_questions
    add column options jsonb not null default '[]'::jsonb;
