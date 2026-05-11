-- Add human_content and learned columns to the reply table
ALTER TABLE "public"."reply"
  ADD COLUMN "human_content" "text",
  ADD COLUMN "learned" boolean NOT NULL DEFAULT false;

-- Backfill from reply_edit where a matching row exists and was actually edited
UPDATE public.reply r
SET
  human_content = re.final_content,
  learned       = re.learned
FROM public.reply_edit re
WHERE re.reply_id = r.id
  AND re.original_content != re.final_content;

-- Drop the reply_edit table (CASCADE removes indexes and constraints)
DROP TABLE IF EXISTS "public"."reply_edit" CASCADE;
