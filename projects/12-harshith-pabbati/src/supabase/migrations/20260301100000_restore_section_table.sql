-- Migration: Restore section table for Agentic RAG
--
-- The previous migration (20260227) removed embedding-based RAG in favour of
-- Gemini URL Context.  This migration restores the section table and
-- match_sections RPC so the system can use pre-embedded content chunks for
-- retrieval, falling back to URL Context only when vector search yields
-- insufficient matches.  This dramatically reduces token usage because only
-- relevant sections are sent to the LLM instead of having Gemini fetch and
-- process every datasource URL.
--
-- Changes:
--   1. Re-create the `section` table (chunked datasource content with vector embeddings)
--   2. Re-create the `match_sections` RPC (vector similarity search)
--   3. Add indexes for FK lookups, embedding search, and null-embedding filtering
--   4. Enable RLS and grant access

-- 1. Section table
CREATE TABLE IF NOT EXISTS "public"."section" (
    "id"              uuid DEFAULT gen_random_uuid() NOT NULL,
    "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
    "datasource_id"   uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "content"         text NOT NULL,
    "heading"         text,
    "embedding"       extensions.vector(768),
    CONSTRAINT "section_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "section_datasource_id_fkey"
        FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id")
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT "section_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE "public"."section" OWNER TO "postgres";

-- 2. Indexes
CREATE INDEX IF NOT EXISTS section_datasource_id_idx
    ON public.section (datasource_id);

CREATE INDEX IF NOT EXISTS section_organization_id_idx
    ON public.section (organization_id);

CREATE INDEX IF NOT EXISTS section_embedding_null_idx
    ON public.section (id)
    WHERE embedding IS NULL;

CREATE INDEX section_embedding_idx
    ON public.section
    USING hnsw (embedding extensions.vector_ip_ops)
    WITH (m = 16, ef_construction = 64);

-- 3. match_sections RPC
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

-- 4. RLS + Grants
ALTER TABLE "public"."section" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members have access to sections" ON "public"."section"
    USING (("organization_id" IN (
        SELECT "public"."get_user_organizations"(
            (SELECT "auth"."uid"() AS "uid"), 0
        ) AS "get_user_organizations"
    )));

GRANT ALL ON TABLE "public"."section" TO "anon";
GRANT ALL ON TABLE "public"."section" TO "authenticated";
GRANT ALL ON TABLE "public"."section" TO "service_role";
