-- Migration: Add api_connection table
--
-- api_connection: Stores external API integrations that Answerify can call
-- during reply generation to fetch live customer data (e.g. invoices, usage).

CREATE TABLE IF NOT EXISTS "public"."api_connection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "base_url" "text" NOT NULL,
    "api_key" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "api_connection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."api_connection" OWNER TO "postgres";

ALTER TABLE ONLY "public"."api_connection"
    ADD CONSTRAINT "api_connection_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "public"."organization"("id")
    ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX "api_connection_organization_id_idx"
    ON "public"."api_connection" USING "btree" ("organization_id");

ALTER TABLE "public"."api_connection" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members have access to api_connections"
    ON "public"."api_connection"
    USING (
        "organization_id" IN (
            SELECT "public"."get_user_organizations"(
                ( SELECT "auth"."uid"() AS "uid"), 0
            ) AS "get_user_organizations"
        )
    );

GRANT ALL ON TABLE "public"."api_connection" TO "anon";
GRANT ALL ON TABLE "public"."api_connection" TO "authenticated";
GRANT ALL ON TABLE "public"."api_connection" TO "service_role";
