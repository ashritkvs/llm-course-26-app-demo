-- Migration: Fix match_sections variable conflict
--
-- Migration 20260303000000 renamed the organization_id parameter to
-- p_organization_id to resolve the ambiguity between the function parameter
-- and the column name, but it also removed the `#variable_conflict use_variable`
-- directive. This left the `embedding` parameter name still conflicting with
-- the `embedding` column in the section table. Without the directive,
-- PostgreSQL may resolve the unqualified `embedding` identifier as the column
-- rather than the parameter, causing the similarity calculation to compare
-- each section's embedding against itself instead of against the query
-- embedding, returning incorrect results or raising an ambiguity error.
--
-- Fix: add a DECLARE block that copies the `embedding` parameter into a
-- local `query_embedding` variable before the RETURN QUERY, so the query
-- body references an unambiguous name. Also switch from the inner-product
-- operator (<#>) to the cosine-distance operator (<=>) so that similarity
-- is computed as 1 - cosine_distance, matching the standard pgvector
-- convention used elsewhere in this project.

CREATE OR REPLACE FUNCTION "public"."match_sections"(
    "embedding"          extensions.vector,
    "match_threshold"    double precision,
    "p_organization_id"  uuid,
    "match_count"        integer DEFAULT 5
)
RETURNS TABLE (
    "id"              uuid,
    "datasource_id"   uuid,
    "organization_id" uuid,
    "content"         text,
    "heading"         text,
    "position"        integer,
    "similarity"      double precision
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_variable
DECLARE
  query_embedding extensions.vector := embedding;
BEGIN
  RETURN QUERY
  SELECT
    section.id,
    section.datasource_id,
    section.organization_id,
    section.content,
    section.heading,
    section.position,
    (1 - (section.embedding <=> query_embedding))::double precision AS similarity
  FROM section
  WHERE (1 - (section.embedding <=> query_embedding)) > match_threshold
    AND section.organization_id = p_organization_id
  ORDER BY section.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
