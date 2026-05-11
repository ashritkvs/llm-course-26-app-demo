-- Migration: Improve match_sections for RAG
--
-- Changes:
--   1. Return a `similarity` score alongside each matched section so the
--      application can use real vector-similarity values as confidence scores
--      instead of a count-based heuristic.
--   2. Add a `match_count` parameter (default 5) so the LIMIT is applied
--      inside the database rather than client-side, reducing data transfer.
--   3. Recreate the HNSW index with explicit m / ef_construction parameters
--      (m = 16, ef_construction = 64 are the pgvector recommended defaults)
--      so the index configuration is transparent and reproducible.
--
-- Safe to run multiple times (CREATE OR REPLACE / DROP IF EXISTS ... CREATE).

-- 1. Replace the match_sections function
CREATE OR REPLACE FUNCTION "public"."match_sections"(
    "embedding"        extensions.vector,
    "match_threshold"  double precision,
    "organization_id"  uuid,
    "match_count"      integer DEFAULT 5
)
RETURNS TABLE (
    "id"              uuid,
    "datasource_id"   uuid,
    "organization_id" uuid,
    "content"         text,
    "similarity"      double precision
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
BEGIN
  RETURN QUERY
  SELECT
    section.id,
    section.datasource_id,
    section.organization_id,
    section.content,
    -(section.embedding <#> embedding) AS similarity
  FROM section
  WHERE -(section.embedding <#> embedding) > match_threshold
    AND section.organization_id = organization_id
  ORDER BY section.embedding <#> embedding
  LIMIT match_count;
END;
$$;

-- 2. Recreate the HNSW index with explicit tuning parameters
--    (DROP + CREATE is the only way to change index storage parameters)
DROP INDEX IF EXISTS public.section_embedding_idx;

CREATE INDEX section_embedding_idx
    ON public.section
    USING hnsw (embedding extensions.vector_ip_ops)
    WITH (m = 16, ef_construction = 64);
