-- Migration: Add tone_policy column to organization table
--
-- tone_policy: Free-text field where org admins can specify tone preferences
-- and policies (e.g. "Always respond formally", "Never mention competitor X")
-- that are injected into the Writing Agent system prompt.

ALTER TABLE public.organization
    ADD COLUMN IF NOT EXISTS tone_policy text;
