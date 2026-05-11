-- ============================================================
-- Full Schema Migration — Socratic Tutor
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. questions table: add MCQ columns
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS options        jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS correct_answer text  DEFAULT NULL;

-- 2. answers table: create if not exists (or add missing columns)
CREATE TABLE IF NOT EXISTS answers (
  answer_id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     uuid        NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
  student_answer  text        NOT NULL,
  correct         boolean     NOT NULL DEFAULT false,
  reasoning_score float       DEFAULT 0,
  misconceptions  jsonb       DEFAULT '[]',
  hints_used      integer     DEFAULT 0,
  response_time   float       DEFAULT NULL,
  feedback        text        DEFAULT '',
  ideal_answer    text        DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

-- If the table already existed without some columns, add them:
ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS feedback        text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS ideal_answer    text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS reasoning_score float   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS misconceptions  jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hints_used      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_time   float   DEFAULT NULL;

-- 3. session_analytics table: create if not exists
CREATE TABLE IF NOT EXISTS session_analytics (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid        NOT NULL UNIQUE REFERENCES sessions(session_id) ON DELETE CASCADE,
  accuracy            float       DEFAULT 0,
  avg_reasoning_score float       DEFAULT 0,
  hint_usage_rate     float       DEFAULT 0,
  weak_topics         jsonb       DEFAULT '[]',
  strong_topics       jsonb       DEFAULT '[]',
  created_at          timestamptz DEFAULT now()
);

-- If it already existed without some columns:
ALTER TABLE session_analytics
  ADD COLUMN IF NOT EXISTS accuracy            float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_reasoning_score float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hint_usage_rate     float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weak_topics         jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS strong_topics       jsonb DEFAULT '[]';

-- ============================================================
-- Verify: run this SELECT to confirm all columns are present
-- ============================================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('questions', 'answers', 'session_analytics')
ORDER BY table_name, ordinal_position;
