-- Migration: Add confidence_score and citations to reply table
--
-- confidence_score: 0.0–1.0 float representing how confident the AI is in
--   its answer. Used by the autopilot feature to decide whether to auto-send.
-- citations: JSONB array of source URLs/metadata referenced in the reply.

ALTER TABLE public.reply
    ADD COLUMN IF NOT EXISTS confidence_score double precision NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS citations       jsonb            NOT NULL DEFAULT '[]'::jsonb;
