-- Migration: Add performance indexes for common query patterns
--
-- Adds covering and composite indexes based on application query patterns
-- to optimize the most frequent database operations.

-- ============================================================
-- THREAD
-- ============================================================

-- Covering index for the primary listing query:
--   WHERE organization_id = ? AND status = ?
--   ORDER BY last_message_created_at DESC
CREATE INDEX IF NOT EXISTS thread_org_status_last_msg_idx
    ON public.thread (organization_id, status, last_message_created_at DESC);

-- Fast lookup by message_id (webhook deduplication)
CREATE INDEX IF NOT EXISTS thread_message_id_idx
    ON public.thread (message_id);

-- The old composite (organization_id, created_at, message_id) is now
-- superseded by the two indexes above. Drop it to avoid write overhead.
DROP INDEX IF EXISTS public.thread_organization_id_created_at_message_id_idx;

-- The standalone status index is now covered by the composite above.
DROP INDEX IF EXISTS public.thread_status_idx;

-- ============================================================
-- EMAIL
-- ============================================================

-- Composite index for loading thread emails in chronological order:
--   WHERE thread_id = ? ORDER BY created_at ASC
-- Replaces the single-column thread_id index.
DROP INDEX IF EXISTS public.email_thread_id_idx;

CREATE INDEX IF NOT EXISTS email_thread_id_created_at_idx
    ON public.email (thread_id, created_at);

-- Filter by organization_id (used in RLS policies)
CREATE INDEX IF NOT EXISTS email_organization_id_idx
    ON public.email (organization_id);

-- ============================================================
-- DATASOURCE
-- ============================================================

-- Composite for internal-KB lookups:
--   WHERE organization_id = ? AND is_internal_kb = true
CREATE INDEX IF NOT EXISTS datasource_org_internal_kb_idx
    ON public.datasource (organization_id, is_internal_kb);

-- ============================================================
-- REPLY
-- ============================================================

-- Composite for reply filtering:
--   WHERE thread_id = ? AND status IN (...) AND is_perfect IS NULL
CREATE INDEX IF NOT EXISTS reply_thread_status_idx
    ON public.reply (thread_id, status, is_perfect);

-- Filter by organization_id (used in RLS policies)
CREATE INDEX IF NOT EXISTS reply_organization_id_idx
    ON public.reply (organization_id);

-- ============================================================
-- REPLY_EDIT
-- ============================================================

-- Composite for loading edits ordered by recency:
--   WHERE reply_id = ? ORDER BY created_at DESC
-- Replaces the single-column reply_id index.
DROP INDEX IF EXISTS public.reply_edit_reply_id_idx;

CREATE INDEX IF NOT EXISTS reply_edit_reply_id_created_at_idx
    ON public.reply_edit (reply_id, created_at DESC);

-- ============================================================
-- SECTION
-- ============================================================

-- FK lookup for cascade deletes and batch updates by datasource
CREATE INDEX IF NOT EXISTS section_datasource_id_idx
    ON public.section (datasource_id);

-- Filter by organization_id (used in match_sections and RLS)
CREATE INDEX IF NOT EXISTS section_organization_id_idx
    ON public.section (organization_id);

-- Partial index to quickly find sections awaiting embedding generation
CREATE INDEX IF NOT EXISTS section_embedding_null_idx
    ON public.section (id)
    WHERE embedding IS NULL;

-- ============================================================
-- MEMBER
-- ============================================================

-- Lookup by user_id (used in RLS policies via get_user_organizations)
CREATE INDEX IF NOT EXISTS member_user_id_idx
    ON public.member (user_id);
