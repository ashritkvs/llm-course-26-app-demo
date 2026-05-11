-- Phase 6: Analytics and Regeneration tables
-- Creates analytics_snapshots and regeneration_requests.
-- Column names match the DB_SCHEMA.md specification exactly.

-- ============================================================
-- analytics_snapshots
-- ============================================================

create table public.analytics_snapshots (
    id                          uuid primary key default gen_random_uuid(),
    workspace_id                uuid not null references public.workspaces(id) on delete cascade,
    user_id                     uuid not null references public.users(id) on delete cascade,
    concept_mastery_state       jsonb not null default '{}',
    error_distribution          jsonb not null default '{}',
    performance_trend_summary   jsonb not null default '{}',
    created_at                  timestamp with time zone not null default now()
);

-- ============================================================
-- regeneration_requests
-- ============================================================

create table public.regeneration_requests (
    id                          uuid primary key default gen_random_uuid(),
    workspace_id                uuid not null references public.workspaces(id) on delete cascade,
    user_id                     uuid not null references public.users(id) on delete cascade,
    source_analytics_snapshot_id uuid not null references public.analytics_snapshots(id) on delete cascade,
    target_concepts             jsonb not null,
    request_status              varchar not null default 'queued',
    generated_exam_id           uuid references public.generated_exams(id) on delete set null,
    created_at                  timestamp with time zone not null default now(),
    updated_at                  timestamp with time zone not null default now(),
    constraint regeneration_requests_status_check
        check (request_status in ('queued', 'running', 'completed', 'failed'))
);

-- ============================================================
-- Indexes on all FK columns
-- ============================================================

create index idx_analytics_snapshots_workspace_id on public.analytics_snapshots(workspace_id);
create index idx_analytics_snapshots_user_id      on public.analytics_snapshots(user_id);

create index idx_regeneration_requests_workspace_id               on public.regeneration_requests(workspace_id);
create index idx_regeneration_requests_user_id                    on public.regeneration_requests(user_id);
create index idx_regeneration_requests_source_analytics_snapshot_id on public.regeneration_requests(source_analytics_snapshot_id);
create index idx_regeneration_requests_generated_exam_id          on public.regeneration_requests(generated_exam_id);

-- ============================================================
-- updated_at trigger for regeneration_requests
-- (reuses set_updated_at() established in earlier migrations)
-- ============================================================

create trigger set_regeneration_requests_updated_at
    before update on public.regeneration_requests
    for each row execute function public.set_updated_at();

-- ============================================================
-- Row-level security
-- ============================================================

alter table public.analytics_snapshots    enable row level security;
alter table public.regeneration_requests  enable row level security;

-- ------------------------------------------------------------------
-- analytics_snapshots: scoped to workspace owner
-- ------------------------------------------------------------------

drop policy if exists "analytics_snapshots_select_own" on public.analytics_snapshots;
create policy "analytics_snapshots_select_own"
on public.analytics_snapshots for select to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = analytics_snapshots.workspace_id
          and w.user_id = auth.uid()
    )
);

drop policy if exists "analytics_snapshots_insert_own" on public.analytics_snapshots;
create policy "analytics_snapshots_insert_own"
on public.analytics_snapshots for insert to authenticated
with check (
    exists (
        select 1 from public.workspaces w
        where w.id = analytics_snapshots.workspace_id
          and w.user_id = auth.uid()
    )
);

drop policy if exists "analytics_snapshots_update_own" on public.analytics_snapshots;
create policy "analytics_snapshots_update_own"
on public.analytics_snapshots for update to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = analytics_snapshots.workspace_id
          and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.workspaces w
        where w.id = analytics_snapshots.workspace_id
          and w.user_id = auth.uid()
    )
);

drop policy if exists "analytics_snapshots_delete_own" on public.analytics_snapshots;
create policy "analytics_snapshots_delete_own"
on public.analytics_snapshots for delete to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = analytics_snapshots.workspace_id
          and w.user_id = auth.uid()
    )
);

-- ------------------------------------------------------------------
-- regeneration_requests: scoped to workspace owner
-- ------------------------------------------------------------------

drop policy if exists "regeneration_requests_select_own" on public.regeneration_requests;
create policy "regeneration_requests_select_own"
on public.regeneration_requests for select to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = regeneration_requests.workspace_id
          and w.user_id = auth.uid()
    )
);

drop policy if exists "regeneration_requests_insert_own" on public.regeneration_requests;
create policy "regeneration_requests_insert_own"
on public.regeneration_requests for insert to authenticated
with check (
    exists (
        select 1 from public.workspaces w
        where w.id = regeneration_requests.workspace_id
          and w.user_id = auth.uid()
    )
);

drop policy if exists "regeneration_requests_update_own" on public.regeneration_requests;
create policy "regeneration_requests_update_own"
on public.regeneration_requests for update to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = regeneration_requests.workspace_id
          and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.workspaces w
        where w.id = regeneration_requests.workspace_id
          and w.user_id = auth.uid()
    )
);

drop policy if exists "regeneration_requests_delete_own" on public.regeneration_requests;
create policy "regeneration_requests_delete_own"
on public.regeneration_requests for delete to authenticated
using (
    exists (
        select 1 from public.workspaces w
        where w.id = regeneration_requests.workspace_id
          and w.user_id = auth.uid()
    )
);
