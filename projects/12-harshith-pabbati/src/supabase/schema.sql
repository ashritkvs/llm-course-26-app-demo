


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_organization_owner"("organization_id" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $_$ select created_by from organization where id = $1 $_$;


ALTER FUNCTION "public"."get_organization_owner"("organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organizations"("user_id" "uuid", "role" integer) RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $_$
  select organization_id from member where user_id = $1 AND role >= $2 
$_$;


ALTER FUNCTION "public"."get_user_organizations"("user_id" "uuid", "role" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_sections"("embedding" "extensions"."vector", "match_threshold" double precision, "p_organization_id" "uuid", "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "datasource_id" "uuid", "organization_id" "uuid", "content" "text", "heading" "text", "position" integer, "similarity" double precision)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."match_sections"("embedding" "extensions"."vector", "match_threshold" double precision, "p_organization_id" "uuid", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."datasource" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url" "text" NOT NULL,
    "is_internal_kb" boolean DEFAULT false,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "datasource_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ready'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."datasource" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_from" "text" NOT NULL,
    "email_from_name" "text" NOT NULL,
    "email_cc" "text"[],
    "email_bcc" "text"[],
    "body" "text" NOT NULL,
    "cleaned_body" "text",
    "is_perfect" boolean,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."email" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_server" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "api_key" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mcp_server" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" smallint DEFAULT '0'::smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "support_email" "text" NOT NULL,
    "inbound_email" "text" NOT NULL,
    "onboarding" "jsonb" DEFAULT '{"step": 2, "hasOnboarded": false}'::"jsonb" NOT NULL,
    "autopilot_enabled" boolean DEFAULT true NOT NULL,
    "autopilot_threshold" real DEFAULT '0.65'::real NOT NULL,
    "tone_policy" "text"
);


ALTER TABLE "public"."organization" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reply" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "thread_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "is_perfect" boolean,
    "organization_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "confidence_score" double precision DEFAULT 0 NOT NULL,
    "citations" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "human_content" "text",
    "learned" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."reply" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."section" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "datasource_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "heading" "text",
    "embedding" "extensions"."vector"(768),
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."section" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."thread" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_from" "text" NOT NULL,
    "email_from_name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "tags" "text"[],
    "last_message_created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "message_id" "text" NOT NULL
);


ALTER TABLE "public"."thread" OWNER TO "postgres";


ALTER TABLE ONLY "public"."datasource"
    ADD CONSTRAINT "datasource_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email"
    ADD CONSTRAINT "email_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_server"
    ADD CONSTRAINT "mcp_server_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member"
    ADD CONSTRAINT "member_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_inbound_email_key" UNIQUE ("inbound_email");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "organization_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reply"
    ADD CONSTRAINT "reply_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."section"
    ADD CONSTRAINT "section_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thread"
    ADD CONSTRAINT "thread_pkey" PRIMARY KEY ("id");



CREATE INDEX "datasource_is_internal_kb_idx" ON "public"."datasource" USING "btree" ("is_internal_kb");



CREATE INDEX "datasource_org_internal_kb_idx" ON "public"."datasource" USING "btree" ("organization_id", "is_internal_kb");



CREATE INDEX "datasource_organization_id_idx" ON "public"."datasource" USING "btree" ("organization_id");



CREATE INDEX "datasource_status_idx" ON "public"."datasource" USING "btree" ("status");



CREATE INDEX "datasource_url_idx" ON "public"."datasource" USING "btree" ("url");



CREATE INDEX "email_organization_id_idx" ON "public"."email" USING "btree" ("organization_id");



CREATE INDEX "email_thread_id_created_at_idx" ON "public"."email" USING "btree" ("thread_id", "created_at");



CREATE INDEX "email_thread_id_idx" ON "public"."email" USING "btree" ("thread_id");



CREATE INDEX "mcp_server_organization_id_idx" ON "public"."mcp_server" USING "btree" ("organization_id");



CREATE INDEX "member_organization_id_user_id_idx" ON "public"."member" USING "btree" ("organization_id", "user_id");



CREATE INDEX "member_user_id_idx" ON "public"."member" USING "btree" ("user_id");



CREATE INDEX "organization_inbound_email_idx" ON "public"."organization" USING "btree" ("inbound_email");



CREATE UNIQUE INDEX "organization_slug_key" ON "public"."organization" USING "btree" ("slug") INCLUDE ("id", "name", "onboarding");



CREATE INDEX "reply_organization_id_idx" ON "public"."reply" USING "btree" ("organization_id");



CREATE INDEX "reply_thread_id_idx" ON "public"."reply" USING "btree" ("thread_id");



CREATE INDEX "reply_thread_status_idx" ON "public"."reply" USING "btree" ("thread_id", "status", "is_perfect");



CREATE INDEX "section_datasource_id_idx" ON "public"."section" USING "btree" ("datasource_id");



CREATE INDEX "section_datasource_position_idx" ON "public"."section" USING "btree" ("datasource_id", "position");



CREATE INDEX "section_embedding_idx" ON "public"."section" USING "hnsw" ("embedding" "extensions"."vector_ip_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "section_embedding_null_idx" ON "public"."section" USING "btree" ("id") WHERE ("embedding" IS NULL);



CREATE INDEX "section_organization_id_idx" ON "public"."section" USING "btree" ("organization_id");



CREATE INDEX "thread_message_id_idx" ON "public"."thread" USING "btree" ("message_id");



CREATE INDEX "thread_org_status_last_msg_idx" ON "public"."thread" USING "btree" ("organization_id", "status", "last_message_created_at" DESC);



CREATE OR REPLACE TRIGGER "generate_reply" AFTER INSERT ON "public"."email" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://answerify.dev/api/webhooks/reply', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "scrape_datasource" AFTER INSERT ON "public"."datasource" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://answerify.dev/api/webhooks/data-source', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



ALTER TABLE ONLY "public"."mcp_server"
    ADD CONSTRAINT "mcp_server_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."datasource"
    ADD CONSTRAINT "public_datasource_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email"
    ADD CONSTRAINT "public_email_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email"
    ADD CONSTRAINT "public_email_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member"
    ADD CONSTRAINT "public_member_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member"
    ADD CONSTRAINT "public_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization"
    ADD CONSTRAINT "public_organization_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reply"
    ADD CONSTRAINT "public_reply_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reply"
    ADD CONSTRAINT "public_reply_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thread"
    ADD CONSTRAINT "public_thread_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."section"
    ADD CONSTRAINT "section_datasource_id_fkey" FOREIGN KEY ("datasource_id") REFERENCES "public"."datasource"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."section"
    ADD CONSTRAINT "section_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Access for organization members" ON "public"."email" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "member"."user_id"
   FROM "public"."member"
  WHERE ("member"."organization_id" = "member"."organization_id"))));



CREATE POLICY "Access to team members" ON "public"."thread" USING ((( SELECT "auth"."uid"() AS "uid") IN ( SELECT "member"."user_id"
   FROM "public"."member"
  WHERE ("member"."organization_id" = "member"."organization_id"))));



CREATE POLICY "Allow delete organization." ON "public"."organization" FOR DELETE USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."member"
  WHERE (("member"."organization_id" = "organization"."id") AND ("member"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("member"."role" = 2))))));



CREATE POLICY "Allow select organization" ON "public"."organization" FOR SELECT USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."member"
  WHERE (("member"."organization_id" = "organization"."id") AND ("member"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Allow to create organization" ON "public"."organization" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Allow to update based on created_by or member." ON "public"."organization" FOR UPDATE USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."member"
  WHERE (("member"."organization_id" = "member"."id") AND ("member"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."member"
  WHERE (("member"."organization_id" = "member"."id") AND ("member"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Enable access for organization members" ON "public"."reply" FOR SELECT USING (("organization_id" IN ( SELECT "public"."get_user_organizations"(( SELECT "auth"."uid"() AS "uid"), 0) AS "get_user_organizations")));



CREATE POLICY "Members can view their organization" ON "public"."member" FOR SELECT USING (("organization_id" IN ( SELECT "public"."get_user_organizations"("auth"."uid"(), 0) AS "get_user_organizations")));



CREATE POLICY "Organization members can invite members" ON "public"."member" FOR INSERT WITH CHECK ((("organization_id" IN ( SELECT "public"."get_user_organizations"(( SELECT "auth"."uid"() AS "uid"), 1) AS "get_user_organizations")) OR (( SELECT "auth"."uid"() AS "uid") IN ( SELECT "public"."get_organization_owner"("member"."organization_id") AS "get_organization_owner"))));



CREATE POLICY "Organization members have access to datasources" ON "public"."datasource" TO "authenticated" USING (("organization_id" IN ( SELECT "public"."get_user_organizations"(( SELECT "auth"."uid"() AS "uid"), 0) AS "get_user_organizations")));



CREATE POLICY "Organization members have access to mcp_servers" ON "public"."mcp_server" USING (("organization_id" IN ( SELECT "public"."get_user_organizations"(( SELECT "auth"."uid"() AS "uid"), 0) AS "get_user_organizations")));



CREATE POLICY "Organization members have access to sections" ON "public"."section" USING (("organization_id" IN ( SELECT "public"."get_user_organizations"(( SELECT "auth"."uid"() AS "uid"), 0) AS "get_user_organizations")));



CREATE POLICY "Organization owners can remove member" ON "public"."member" FOR DELETE USING (("organization_id" IN ( SELECT "public"."get_user_organizations"(( SELECT "auth"."uid"() AS "uid"), 2) AS "get_user_organizations")));



CREATE POLICY "Organization owners can update member" ON "public"."member" FOR UPDATE USING (("organization_id" IN ( SELECT "public"."get_user_organizations"(( SELECT "auth"."uid"() AS "uid"), 2) AS "get_user_organizations")));



ALTER TABLE "public"."datasource" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_server" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reply" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."section" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thread" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."thread";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





















































































































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



































































































































































































































































































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;




































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;





























































































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;















GRANT ALL ON FUNCTION "public"."get_organization_owner"("organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_owner"("organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_owner"("organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organizations"("user_id" "uuid", "role" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organizations"("user_id" "uuid", "role" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organizations"("user_id" "uuid", "role" integer) TO "service_role";






GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";













































GRANT ALL ON TABLE "public"."datasource" TO "anon";
GRANT ALL ON TABLE "public"."datasource" TO "authenticated";
GRANT ALL ON TABLE "public"."datasource" TO "service_role";



GRANT ALL ON TABLE "public"."email" TO "anon";
GRANT ALL ON TABLE "public"."email" TO "authenticated";
GRANT ALL ON TABLE "public"."email" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_server" TO "anon";
GRANT ALL ON TABLE "public"."mcp_server" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_server" TO "service_role";



GRANT ALL ON TABLE "public"."member" TO "anon";
GRANT ALL ON TABLE "public"."member" TO "authenticated";
GRANT ALL ON TABLE "public"."member" TO "service_role";



GRANT ALL ON TABLE "public"."organization" TO "anon";
GRANT ALL ON TABLE "public"."organization" TO "authenticated";
GRANT ALL ON TABLE "public"."organization" TO "service_role";



GRANT ALL ON TABLE "public"."reply" TO "anon";
GRANT ALL ON TABLE "public"."reply" TO "authenticated";
GRANT ALL ON TABLE "public"."reply" TO "service_role";



GRANT ALL ON TABLE "public"."section" TO "anon";
GRANT ALL ON TABLE "public"."section" TO "authenticated";
GRANT ALL ON TABLE "public"."section" TO "service_role";



GRANT ALL ON TABLE "public"."thread" TO "anon";
GRANT ALL ON TABLE "public"."thread" TO "authenticated";
GRANT ALL ON TABLE "public"."thread" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































