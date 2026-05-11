-- Migration: Add workflow table for automation rules
-- Version: 20260321000000
-- Description: Adds the workflow table to enable automated actions based on email triggers

-- Create the workflow table
CREATE TABLE IF NOT EXISTS "public"."workflow" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "organization_id" uuid NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "enabled" boolean DEFAULT true NOT NULL,
    "trigger" jsonb NOT NULL,
    "steps" jsonb DEFAULT '[]'::jsonb NOT NULL
);

-- Add primary key
ALTER TABLE "public"."workflow" OWNER TO "postgres";

ALTER TABLE ONLY "public"."workflow"
    ADD CONSTRAINT "workflow_pkey" PRIMARY KEY ("id");

-- Add foreign key constraint
ALTER TABLE ONLY "public"."workflow"
    ADD CONSTRAINT "workflow_organization_id_fkey" 
    FOREIGN KEY ("organization_id") 
    REFERENCES "public"."organization"("id") 
    ON UPDATE CASCADE 
    ON DELETE CASCADE;

-- Create indexes for common queries
CREATE INDEX "workflow_organization_id_idx" ON "public"."workflow" USING "btree" ("organization_id");
CREATE INDEX "workflow_enabled_idx" ON "public"."workflow" USING "btree" ("enabled");
CREATE INDEX "workflow_org_enabled_idx" ON "public"."workflow" USING "btree" ("organization_id", "enabled");

-- Add RLS policy for workflow
CREATE POLICY "Organization members have access to workflows" ON "public"."workflow"
    USING (
        "organization_id" IN (
            SELECT "public"."get_user_organizations"("auth"."uid"(), 0)
        )
    );

-- Enable RLS on the workflow table
ALTER TABLE "public"."workflow" ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE "public"."workflow" TO "anon";
GRANT ALL ON TABLE "public"."workflow" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow" TO "service_role";
