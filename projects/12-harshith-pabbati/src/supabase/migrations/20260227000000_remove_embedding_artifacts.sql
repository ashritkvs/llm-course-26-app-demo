-- Migration: Remove embedding-related artifacts
--
-- With the switch to Gemini URL Context for reply generation,
-- the embedding-based RAG pipeline is no longer used. This migration
-- removes all embedding-related database objects:
--
--   1. The `section` table (chunked datasource content with vector embeddings)
--   2. The `embedding` column on the `email` table
--   3. The `match_sections` RPC function (vector similarity search)
--   4. The `match_email_sections` RPC function (email vector search)
--
-- Related indexes on the section table are dropped automatically
-- when the table is dropped (CASCADE).

-- 1. Drop the section table and all dependent objects
DROP TABLE IF EXISTS public.section CASCADE;

-- 2. Drop the embedding column from the email table
ALTER TABLE public.email DROP COLUMN IF EXISTS embedding;

-- 3. Drop the match_sections RPC function (all overloads)
DROP FUNCTION IF EXISTS public.match_sections(
    extensions.vector, double precision, uuid, integer
);
DROP FUNCTION IF EXISTS public.match_sections(
    extensions.vector, double precision, uuid
);

-- 4. Drop the match_email_sections RPC function
DROP FUNCTION IF EXISTS public.match_email_sections(
    extensions.vector, double precision, uuid
);
