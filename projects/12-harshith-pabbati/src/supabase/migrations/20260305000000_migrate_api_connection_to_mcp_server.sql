-- Migration: Replace api_connection with mcp_server
--
-- Drops the legacy api_connection table and creates mcp_server in its place.
-- mcp_server stores MCP (Model Context Protocol) server endpoints that
-- Answerify connects to during reply generation so the AI can call tools
-- exposed by those servers to fetch live customer data.

DROP TABLE IF EXISTS "public"."api_connection";

CREATE TABLE IF NOT EXISTS "public"."mcp_server" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "api_key" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mcp_server_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."mcp_server" OWNER TO "postgres";

ALTER TABLE ONLY "public"."mcp_server"
    ADD CONSTRAINT "mcp_server_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "public"."organization"("id")
    ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX "mcp_server_organization_id_idx"
    ON "public"."mcp_server" USING "btree" ("organization_id");

ALTER TABLE "public"."mcp_server" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members have access to mcp_servers"
    ON "public"."mcp_server"
    USING (
        "organization_id" IN (
            SELECT "public"."get_user_organizations"(
                ( SELECT "auth"."uid"() AS "uid"), 0
            ) AS "get_user_organizations"
        )
    );

GRANT ALL ON TABLE "public"."mcp_server" TO "anon";
GRANT ALL ON TABLE "public"."mcp_server" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_server" TO "service_role";
