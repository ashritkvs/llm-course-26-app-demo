-- ============================================================
-- Socratic Tutor — Supabase Schema (v2)
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- 1. Users (populated on Google OAuth login)
-- ---------------------------------------------------------
create table if not exists users (
    id            uuid primary key default uuid_generate_v4(),
    google_id     text unique not null,
    email         text unique not null,
    display_name  text default '',
    avatar_url    text default '',
    created_at    timestamptz default now()
);

-- ---------------------------------------------------------
-- 2. Sessions (one row per quiz attempt)
--    source_type distinguishes topic-based vs PDF-based quizzes
-- ---------------------------------------------------------
create table if not exists sessions (
    session_id        uuid primary key default uuid_generate_v4(),
    user_id           uuid references users(id) on delete cascade,
    topic             text not null,
    source_type       text not null default 'topic' check (source_type in ('topic', 'pdf')),
    difficulty_level  text not null check (difficulty_level in ('easy', 'medium', 'hard')),
    start_time        timestamptz default now(),
    end_time          timestamptz            -- null until quiz is completed
);

-- ---------------------------------------------------------
-- 3. Questions (generated per session)
--    Three progressive Socratic hints per question
-- ---------------------------------------------------------
create table if not exists questions (
    question_id    uuid primary key default uuid_generate_v4(),
    session_id     uuid references sessions(session_id) on delete cascade,
    question_text  text not null,
    concept_tag    text not null,           -- single concept label
    difficulty     text not null check (difficulty in ('easy', 'medium', 'hard')),
    hint_1         text,                    -- gentle nudge
    hint_2         text,                    -- more specific guidance
    hint_3         text,                    -- nearly reveals the answer
    -- MCQ-only fields (NULL for open-ended questions)
    options        text[],                  -- array of 4 option strings
    correct_answer text                     -- full text of correct option; NULL = open-ended
);

-- ---------------------------------------------------------
-- 4. Answers (one per answered question)
--    Tracks correctness, reasoning quality, misconceptions,
--    how many hints were consumed, and response time.
-- ---------------------------------------------------------
create table if not exists answers (
    answer_id        uuid primary key default uuid_generate_v4(),
    question_id      uuid references questions(question_id) on delete cascade,
    student_answer   text not null,
    correct          boolean not null,
    reasoning_score  real default 0 check (reasoning_score >= 0 and reasoning_score <= 1),
    misconceptions   text[],                -- array of identified misconceptions
    hints_used       int default 0 check (hints_used >= 0 and hints_used <= 3),
    response_time    real,                  -- seconds taken to answer
    -- Gemini evaluation enrichment (stored so session replay works without re-calling Gemini)
    feedback         text default '',       -- human-readable explanation
    ideal_answer     text default ''        -- model answer to show after submission
);

-- ---------------------------------------------------------
-- 5. Concept Mastery (aggregated per-user per-concept)
--    Updated after every answer submission.
-- ---------------------------------------------------------
create table if not exists concept_mastery (
    user_id          uuid references users(id) on delete cascade,
    concept_tag      text not null,
    attempts         int default 0,
    correct_answers  int default 0,
    mastery_score    real default 0 check (mastery_score >= 0 and mastery_score <= 1),
    primary key (user_id, concept_tag)
);

-- ---------------------------------------------------------
-- 6. Session Analytics (computed after each session ends)
--    Caches per-session aggregate metrics.
-- ---------------------------------------------------------
create table if not exists session_analytics (
    session_id          uuid primary key references sessions(session_id) on delete cascade,
    accuracy            real default 0,
    weak_topics         text[],              -- concept tags with accuracy < 60%
    strong_topics       text[],              -- concept tags with accuracy > 80%
    avg_reasoning_score real default 0,
    hint_usage_rate     real default 0       -- fraction of questions where hints were used
);

-- ---------------------------------------------------------
-- Indexes for common queries
-- ---------------------------------------------------------
create index if not exists idx_sessions_user       on sessions(user_id);
create index if not exists idx_questions_session    on questions(session_id);
create index if not exists idx_questions_concept    on questions(concept_tag);
create index if not exists idx_answers_question     on answers(question_id);
create index if not exists idx_concept_mastery_user on concept_mastery(user_id);


-- =========================================================
-- ANALYTICS QUERY PATTERNS
-- =========================================================

-- ---------------------------------------------------------
-- Q1: Compute session accuracy + reasoning score
--     Run this when a session ends to populate session_analytics.
-- ---------------------------------------------------------
-- insert into session_analytics (session_id, accuracy, avg_reasoning_score, hint_usage_rate, weak_topics, strong_topics)
-- select
--     s.session_id,
--     -- accuracy = correct answers / total answers
--     coalesce(avg(a.correct::int), 0)                               as accuracy,
--     -- average reasoning score across all answers
--     coalesce(avg(a.reasoning_score), 0)                            as avg_reasoning_score,
--     -- hint usage rate = questions where hints > 0 / total questions
--     coalesce(avg(case when a.hints_used > 0 then 1 else 0 end), 0) as hint_usage_rate,
--     -- weak topics: concept tags where per-tag accuracy < 60%
--     array(
--         select q2.concept_tag
--         from questions q2
--         join answers a2 on a2.question_id = q2.question_id
--         where q2.session_id = s.session_id
--         group by q2.concept_tag
--         having avg(a2.correct::int) < 0.6
--     )                                                              as weak_topics,
--     -- strong topics: concept tags where per-tag accuracy > 80%
--     array(
--         select q3.concept_tag
--         from questions q3
--         join answers a3 on a3.question_id = q3.question_id
--         where q3.session_id = s.session_id
--         group by q3.concept_tag
--         having avg(a3.correct::int) > 0.8
--     )                                                              as strong_topics
-- from sessions s
-- join questions q on q.session_id = s.session_id
-- join answers   a on a.question_id = q.question_id
-- where s.session_id = '<TARGET_SESSION_ID>'
-- group by s.session_id;


-- ---------------------------------------------------------
-- Q2: Update concept mastery after an answer
--     Upserts the concept_mastery row.
-- ---------------------------------------------------------
-- insert into concept_mastery (user_id, concept_tag, attempts, correct_answers, mastery_score)
-- values (
--     '<USER_ID>',
--     '<CONCEPT_TAG>',
--     1,
--     case when <IS_CORRECT> then 1 else 0 end,
--     case when <IS_CORRECT> then 1.0 else 0.0 end
-- )
-- on conflict (user_id, concept_tag)
-- do update set
--     attempts        = concept_mastery.attempts + 1,
--     correct_answers = concept_mastery.correct_answers + case when <IS_CORRECT> then 1 else 0 end,
--     mastery_score   = (concept_mastery.correct_answers + case when <IS_CORRECT> then 1 else 0 end)::real
--                       / (concept_mastery.attempts + 1);


-- ---------------------------------------------------------
-- Q3: Get weak & strong topics for a user (across all time)
-- ---------------------------------------------------------
-- Strong: mastery_score > 0.80 AND attempts >= 3
-- select concept_tag, mastery_score, attempts
-- from concept_mastery
-- where user_id = '<USER_ID>' and mastery_score > 0.8 and attempts >= 3
-- order by mastery_score desc;

-- Weak: mastery_score < 0.60 AND attempts >= 3
-- select concept_tag, mastery_score, attempts
-- from concept_mastery
-- where user_id = '<USER_ID>' and mastery_score < 0.6 and attempts >= 3
-- order by mastery_score asc;
