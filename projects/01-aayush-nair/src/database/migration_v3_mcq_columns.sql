-- ============================================================
-- Migration v3: Add MCQ columns to questions + enrichment
--               columns to answers
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ---------------------------------------------------------
-- 1. questions: add MCQ-specific columns
--    options       — array of 4 option strings (null for open-ended)
--    correct_answer — full text of the correct option (null for open-ended)
-- ---------------------------------------------------------
alter table questions
    add column if not exists options        text[]  default null,
    add column if not exists correct_answer text    default null;

-- ---------------------------------------------------------
-- 2. answers: add Gemini evaluation enrichment columns
--    feedback     — human-readable explanation from Gemini
--    ideal_answer — model answer shown after submission
-- ---------------------------------------------------------
alter table answers
    add column if not exists feedback     text default '',
    add column if not exists ideal_answer text default '';

-- Verify
select column_name, data_type
from information_schema.columns
where table_name in ('questions', 'answers')
  and column_name in ('options', 'correct_answer', 'feedback', 'ideal_answer')
order by table_name, column_name;
