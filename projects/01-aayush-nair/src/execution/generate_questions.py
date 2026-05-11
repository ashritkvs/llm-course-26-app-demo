"""
generate_questions.py — Socratic quiz question generator via Gemini

Generates questions with 3 progressive Socratic hints and an expected
reasoning chain. Optionally uses user performance history to personalize.

Usage:
    python generate_questions.py --concept "circular wait" --difficulty medium --count 5

Returns JSON list to stdout.
"""

import os
import sys
import json
import argparse
from dotenv import load_dotenv
from google import genai

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY must be set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-pro"

# Add parent dir for supabase imports
sys.path.insert(0, os.path.dirname(__file__))
from supabase_client import supabase


# ---- Prompt ----

def build_prompt(concept: str, difficulty: str, count: int,
                 user_performance: dict = None, question_format: str = "open",
                 source_text: str = None) -> str:
    """
    Build the Gemini prompt for Socratic question generation.

    Args:
        concept: The concept tag to generate questions for.
        difficulty: easy | medium | hard.
        count: Number of questions to generate.
        user_performance: Optional dict with mastery_score, attempts,
                          correct_answers, and known misconceptions.
        question_format: 'open' for free-text Socratic, 'mcq' for multiple-choice.
    """
    difficulty_guide = {
        "easy": "recall and basic understanding — definitions, identification, simple facts",
        "medium": "application and analysis — applying concepts to scenarios, comparing, explaining why",
        "hard": "synthesis and evaluation — combining multiple ideas, debugging complex scenarios, designing solutions",
    }

    performance_context = ""
    if user_performance:
        mastery = user_performance.get("mastery_score", 0)
        attempts = user_performance.get("attempts", 0)
        misconceptions = user_performance.get("misconceptions", [])

        performance_context = f"""
The student has attempted {attempts} questions on this concept with a mastery score of {mastery:.0%}.
"""
        if misconceptions:
            performance_context += f"Known misconceptions to target: {', '.join(misconceptions)}\n"
        if mastery > 0.8:
            performance_context += "The student is strong here — generate challenging edge-case questions.\n"
        elif mastery < 0.5:
            performance_context += "The student struggles here — focus on foundational understanding.\n"

    # Build source context block (used when PDF text is provided)
    source_block = ""
    if source_text:
        source_block = f"\nSource material to base questions on:\n---\n{source_text[:3000]}\n---\n"

    if question_format == "mcq":
        return f"""You are an expert educational assessment AI generating multiple-choice quiz questions.

Generate exactly {count} MCQ questions on the topic: "{concept}"
{source_block}
Difficulty: {difficulty} ONLY — {difficulty_guide.get(difficulty, difficulty_guide['medium'])}
This is STRICT. Do NOT generate questions outside this difficulty level.

{performance_context}

For EACH question return a JSON object with these exact keys:
1. "question"        — the question text
2. "concept_tag"     — a SHORT label (2–5 words) naming the specific sub-topic this question tests. NEVER use long sentences, never use the full source text.
3. "difficulty"      — must be exactly "{difficulty}"
4. "options"         — a JSON array of exactly 4 strings: ["Option A text", "Option B text", "Option C text", "Option D text"]
5. "correct_answer"  — the FULL TEXT of the correct option (must exactly match one element in options)
6. "hint_1"          — a gentle Socratic question (NEVER reveals the answer directly)
7. "hint_2"          — a more specific Socratic question
8. "hint_3"          — a strong Socratic clue (still requires thinking)
9. "expected_reasoning" — JSON array of 2–4 steps of expected reasoning

Rules:
- All 4 options must be plausible; only one is correct.
- Distractors must represent real misconceptions a student might have.
- Hints must be QUESTIONS, not statements.
- concept_tag MUST be a short label like "Fault Tolerance" or "Two-Phase Commit", never a sentence.

Return ONLY a valid JSON array. No markdown fences, no explanation."""

    # Default: open-ended Socratic
    return f"""You are an expert Socratic tutor generating quiz questions.

Generate exactly {count} questions on the topic: "{concept}"
{source_block}
Difficulty: {difficulty} ONLY — {difficulty_guide.get(difficulty, difficulty_guide['medium'])}
This is STRICT. Do NOT generate questions outside this difficulty level.

{performance_context}

For EACH question, return a JSON object with these exact keys:
1. "question"        — the question text
2. "concept_tag"     — a SHORT label (2–5 words) naming the specific sub-topic this question tests. NEVER use long sentences, never use the full source text. Examples: "Paxos Consensus", "Deadlock Detection", "Two-Phase Commit".
3. "concept_tags"    — a JSON array of 2–4 SHORT topic labels (each 2–5 words) covering relevant sub-concepts. The first element should match concept_tag. Examples: ["Fault Tolerance", "Data Replication", "Cluster Architecture"]
4. "difficulty"      — must be exactly "{difficulty}"
5. "hint_1"          — a gentle, broad Socratic question that activates prior knowledge (NEVER reveals the answer)
6. "hint_2"          — a more specific Socratic question that narrows the reasoning path (NEVER reveals the answer)
7. "hint_3"          — a strong Socratic clue question that nearly reveals the answer but still requires the student to connect the dots (NEVER reveals the answer)
8. "expected_reasoning" — a JSON array of 2–5 strings describing step-by-step expected reasoning

CRITICAL RULES:
- concept_tag and every item in concept_tags MUST be short labels (2–5 words), never sentences or raw source text.
- All hints must be QUESTIONS, not statements. Hints must GUIDE reasoning, never REVEAL the answer.
- Each hint should build progressively on the previous one.

Return ONLY a valid JSON array. No markdown fences, no explanation, just the JSON array."""


# ---- Validation ----

REQUIRED_KEYS_OPEN = {"question", "concept_tag", "difficulty", "hint_1", "hint_2", "hint_3", "expected_reasoning"}
REQUIRED_KEYS_MCQ  = {"question", "concept_tag", "difficulty", "options", "correct_answer", "hint_1", "hint_2", "hint_3", "expected_reasoning"}


def validate_questions(questions: list[dict], concept: str, difficulty: str,
                       question_format: str = "open",
                       enforce_concept_tag: bool = True) -> None:
    """
    Validate the generated questions match the expected schema.
    enforce_concept_tag=False is used when source_text was provided (PDF mode)
    so Gemini's chosen short label is preserved rather than overwritten.
    """
    if not isinstance(questions, list):
        raise ValueError("Gemini did not return a JSON array")

    required = REQUIRED_KEYS_MCQ if question_format == "mcq" else REQUIRED_KEYS_OPEN

    for i, q in enumerate(questions):
        missing = required - set(q.keys())
        if missing:
            raise ValueError(f"Question {i + 1} missing keys: {missing}")

        if not q["question"].strip():
            raise ValueError(f"Question {i + 1} has empty question text")

        if enforce_concept_tag and q["concept_tag"] != concept:
            q["concept_tag"] = concept

        if q["difficulty"] != difficulty:
            q["difficulty"] = difficulty

        for hint_key in ("hint_1", "hint_2", "hint_3"):
            if not isinstance(q[hint_key], str) or not q[hint_key].strip():
                raise ValueError(f"Question {i + 1}: {hint_key} must be a non-empty string")

        if not isinstance(q["expected_reasoning"], list) or len(q["expected_reasoning"]) < 2:
            raise ValueError(f"Question {i + 1}: expected_reasoning must have ≥ 2 steps")

        if question_format == "mcq":
            if not isinstance(q.get("options"), list) or len(q["options"]) != 4:
                raise ValueError(f"Question {i + 1}: MCQ must have exactly 4 options")
            if q.get("correct_answer") not in q["options"]:
                # Auto-fix: pick first option if Gemini made a mistake
                q["correct_answer"] = q["options"][0]


def validate_questions_batch(questions: list[dict], concept: str,
                              difficulty_list: list[str],
                              question_format: str = "open",
                              enforce_concept_tag: bool = True) -> None:
    """
    Validate batch-generated questions where each question has its own difficulty.
    enforce_concept_tag=False preserves short labels chosen by Gemini (PDF mode).
    """
    if not isinstance(questions, list):
        raise ValueError("Gemini did not return a JSON array")

    required = REQUIRED_KEYS_MCQ if question_format == "mcq" else REQUIRED_KEYS_OPEN

    for i, q in enumerate(questions):
        assigned_diff = difficulty_list[i] if i < len(difficulty_list) else "medium"

        missing = required - set(q.keys())
        if missing:
            raise ValueError(f"Question {i + 1} missing keys: {missing}")

        if not q.get("question", "").strip():
            raise ValueError(f"Question {i + 1} has empty question text")

        # Only overwrite concept_tag if enforced (topic/non-PDF mode)
        if enforce_concept_tag:
            q["concept_tag"] = concept
        q["difficulty"] = assigned_diff

        # Graceful fallback for hints (don't abort batch for one bad hint)
        for hint_key in ("hint_1", "hint_2", "hint_3"):
            if not isinstance(q.get(hint_key), str) or not q[hint_key].strip():
                q[hint_key] = f"Think carefully about the concept: {concept}."

        # Graceful fallback for expected_reasoning
        if not isinstance(q.get("expected_reasoning"), list) or len(q.get("expected_reasoning", [])) < 2:
            q["expected_reasoning"] = [f"Consider what you know about {concept}.", "Apply the concept to the question."]

        if question_format == "mcq":
            if not isinstance(q.get("options"), list) or len(q["options"]) != 4:
                raise ValueError(f"Question {i + 1}: MCQ must have exactly 4 options")
            if q.get("correct_answer") not in q["options"]:
                q["correct_answer"] = q["options"][0]


# ── Batch Prompt Builder ──────────────────────────────────────────────────────

def build_prompt_batch(concept: str, difficulty_list: list[str],
                       user_performance: dict = None,
                       question_format: str = "open",
                       source_text: str = None) -> str:
    """
    Build a single Gemini prompt that generates ALL questions in one call,
    each at its assigned difficulty level.
    """
    count = len(difficulty_list)
    difficulty_guide = {
        "easy": "recall and basic understanding — definitions, identification, simple facts",
        "medium": "application and analysis — applying concepts to scenarios, comparing, explaining why",
        "hard": "synthesis and evaluation — combining multiple ideas, debugging complex scenarios, designing solutions",
    }

    # Build numbered difficulty assignment block
    difficulty_assignment = "\n".join(
        f"  Question {i + 1}: {diff} — {difficulty_guide.get(diff, diff)}"
        for i, diff in enumerate(difficulty_list)
    )

    performance_context = ""
    if user_performance:
        mastery = user_performance.get("mastery_score", 0)
        attempts = user_performance.get("attempts", 0)
        misconceptions = user_performance.get("misconceptions", [])
        performance_context = f"\nThe student has attempted {attempts} questions on this concept with a mastery score of {mastery:.0%}.\n"
        if misconceptions:
            performance_context += f"Known misconceptions to target: {', '.join(misconceptions)}\n"
        if mastery > 0.8:
            performance_context += "The student is strong here — weight harder questions more carefully.\n"
        elif mastery < 0.5:
            performance_context += "The student struggles here — ensure easier questions are foundational.\n"

    source_block = ""
    if source_text:
        source_block = f"\nSource material to base questions on:\n---\n{source_text[:3000]}\n---\n"

    if question_format == "mcq":
        return f"""You are an expert educational assessment AI generating multiple-choice quiz questions.

Generate exactly {count} MCQ questions on the topic: "{concept}"
{source_block}
Each question has a SPECIFIC assigned difficulty. You MUST follow this assignment exactly:
{difficulty_assignment}
{performance_context}
For EACH question return a JSON object with these exact keys:
1. "question"        — the question text
2. "concept_tag"     — a SHORT label (2–5 words) naming the specific sub-topic tested. NEVER use long sentences or raw source text.
3. "difficulty"      — must EXACTLY match the assigned difficulty for that question number
4. "options"         — JSON array of exactly 4 strings: ["Option A", "Option B", "Option C", "Option D"]
5. "correct_answer"  — the FULL TEXT of the correct option (must exactly match one element in options)
6. "hint_1"          — gentle Socratic question (NEVER reveals the answer)
7. "hint_2"          — more specific Socratic question
8. "hint_3"          — strong Socratic clue (still requires thinking)
9. "expected_reasoning" — JSON array of 2–4 expected reasoning steps

Rules:
- All 4 options must be plausible; only one is correct.
- concept_tag MUST be a short label like "Data Replication" or "Paxos Consensus", never a sentence.
- The difficulty field in each returned question MUST equal its assigned difficulty.

Return ONLY a valid JSON array of exactly {count} objects. No markdown fences, no explanation."""

    # Default: open-ended Socratic batch
    return f"""You are an expert Socratic tutor generating quiz questions.

Generate exactly {count} questions on the topic: "{concept}"
{source_block}
Each question has a SPECIFIC assigned difficulty. You MUST follow this assignment exactly:
{difficulty_assignment}
{performance_context}
For EACH question return a JSON object with these exact keys:
1. "question"           — the question text
2. "concept_tag"        — a SHORT label (2–5 words) naming the specific sub-topic this question tests. NEVER use long sentences or raw source text. Examples: "Paxos Consensus", "Fault Tolerance", "Two-Phase Commit".
3. "concept_tags"       — JSON array of 2–4 SHORT topic labels (each 2–5 words); the first must match concept_tag.
4. "difficulty"         — must EXACTLY match the assigned difficulty for that question number
5. "hint_1"             — gentle, broad Socratic question that activates prior knowledge (NEVER reveals the answer)
6. "hint_2"             — more specific Socratic question that narrows the reasoning path (NEVER reveals the answer)
7. "hint_3"             — strong Socratic clue question that nearly reveals the answer but still requires thinking (NEVER reveals the answer)
8. "expected_reasoning" — JSON array of 2–5 strings describing step-by-step reasoning

CRITICAL RULES:
- concept_tag and every item in concept_tags MUST be short labels (2–5 words).
- All hints must be QUESTIONS, not statements.
- Questions should cover different sub-aspects — avoid repetition.
- The difficulty field in each returned question MUST equal its assigned difficulty.

Return ONLY a valid JSON array of exactly {count} objects. No markdown fences, no explanation."""




def generate_questions(
    concept: str,
    difficulty: str = "medium",
    count: int = 5,
    user_performance: dict = None,
    session_id: str = None,
    store: bool = True,
    question_format: str = "open",
    source_text: str = None,
) -> list[dict]:
    """
    Generate quiz questions using Gemini (all at a single difficulty).

    Used for: forced-difficulty mode, /quiz/next (per-question adaptive),
              and reinforcement mode.

    For adaptive batch generation (start_quiz adaptive mode), use
    generate_questions_batch() instead.
    """
    prompt = build_prompt(concept, difficulty, count, user_performance, question_format,
                         source_text=source_text)

    response = client.models.generate_content(model=MODEL, contents=prompt)
    text = response.text.strip()

    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]

    # Parse JSON
    try:
        questions = json.loads(text)
    except json.JSONDecodeError:
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY the raw JSON array. No markdown, no backticks, no extra text."
        response = client.models.generate_content(model=MODEL, contents=retry_prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        questions = json.loads(text)

    # Validate — don't force concept_tag when source_text was provided
    # (Gemini picks a short label from source content, not the full concept string)
    validate_questions(questions, concept, difficulty, question_format,
                       enforce_concept_tag=source_text is None)

    # Store in Supabase if session_id is provided
    if store and session_id:
        _store_questions(session_id, questions, question_format)

    return questions


def generate_questions_batch(
    concept: str,
    difficulty_list: list[str],
    user_performance: dict = None,
    session_id: str = None,
    store: bool = True,
    question_format: str = "open",
    source_text: str = None,
) -> list[dict]:
    """
    Generate all quiz questions in a SINGLE Gemini call with mixed difficulties.

    Used exclusively by start_quiz() in adaptive mode.
    """
    if not difficulty_list:
        return []

    prompt = build_prompt_batch(concept, difficulty_list, user_performance, question_format,
                                source_text=source_text)

    response = client.models.generate_content(model=MODEL, contents=prompt)
    text = response.text.strip()

    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]

    # Parse JSON — retry once on failure
    try:
        questions = json.loads(text)
    except json.JSONDecodeError:
        retry_prompt = prompt + "\n\nIMPORTANT: Return ONLY the raw JSON array. No markdown, no backticks, no extra text."
        response = client.models.generate_content(model=MODEL, contents=retry_prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        questions = json.loads(text)

    # Validate (batch-aware — don't enforce concept_tag when source_text provided)
    validate_questions_batch(questions, concept, difficulty_list, question_format,
                             enforce_concept_tag=source_text is None)

    # Truncate/pad to exact count (Gemini occasionally returns N±1)
    questions = questions[:len(difficulty_list)]
    while len(questions) < len(difficulty_list):
        missing_diff = difficulty_list[len(questions)]
        fallback = generate_questions(concept, missing_diff, 1, user_performance,
                                      session_id=None, store=False, question_format=question_format,
                                      source_text=source_text)
        questions.extend(fallback)

    # Store in Supabase if session_id is provided
    if store and session_id:
        _store_questions(session_id, questions, question_format)

    return questions




def _store_questions(session_id: str, questions: list[dict],
                     question_format: str = "open") -> list[dict]:
    """
    Store generated questions in the Supabase questions table.

    - Open-ended (question_format='open'): stores core fields only.
      options and correct_answer columns are intentionally omitted so they
      remain NULL — this is the signal used by /quiz/answer to detect
      open-ended mode and route to Gemini evaluation.
    - MCQ (question_format='mcq'): additionally stores options[] and
      correct_answer so /quiz/answer can evaluate deterministically.
    """
    stored = []
    for q in questions:
        row = {
            "session_id": session_id,
            "question_text": q["question"],
            "concept_tag": q["concept_tag"],
            "difficulty": q["difficulty"],
            "hint_1": q["hint_1"],
            "hint_2": q["hint_2"],
            "hint_3": q["hint_3"],
            # MCQ fields — only set for mcq format, omitted for open-ended
            # so they default to NULL in the DB (signals open-ended mode)
        }
        if question_format == "mcq":
            row["options"] = q.get("options", [])
            row["correct_answer"] = q.get("correct_answer", "") or None
        result = supabase.table("questions").insert(row).execute()
        stored_row = result.data[0]
        q["question_id"] = stored_row["question_id"]
        stored.append(stored_row)

    return stored


def generate_reinforcement_questions(
    weak_topics: list,
    difficulty: str = "easy",
    count_per_topic: int = 1,
    session_id: str = None,
    store: bool = True,
    question_format: str = "open",
) -> list:
    """
    Generate reinforcement questions targeting specific weak concept tags.

    For each weak topic, generates `count_per_topic` question(s) at the given
    difficulty level, then returns all of them as a flat list.

    Args:
        weak_topics:     List of concept tag strings to reinforce.
        difficulty:      Difficulty level for ALL reinforcement questions.
        count_per_topic: How many questions per topic (usually 1–2).
        session_id:      Optional UUID for DB storage.
        store:           Whether to persist to Supabase.
        question_format: 'open' or 'mcq'.

    Returns:
        Flat list of question dicts in the same format as generate_questions().
    """
    if not weak_topics:
        return []

    all_questions = []
    for topic in weak_topics:
        qs = generate_questions(
            concept=topic,
            difficulty=difficulty,
            count=count_per_topic,
            user_performance=None,
            session_id=session_id,
            store=store,
            question_format=question_format,
        )
        all_questions.extend(qs)

    return all_questions


# ---- CLI ----

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Socratic quiz questions via Gemini")
    parser.add_argument("--concept", required=True, help="Concept tag to generate questions for")
    parser.add_argument("--difficulty", default="medium", choices=["easy", "medium", "hard"])
    parser.add_argument("--count", type=int, default=5, help="Number of questions")
    parser.add_argument("--session-id", default=None, help="Session UUID (optional, for storing)")
    parser.add_argument("--no-store", action="store_true", help="Skip storing in Supabase")
    args = parser.parse_args()

    result = generate_questions(
        concept=args.concept,
        difficulty=args.difficulty,
        count=args.count,
        session_id=args.session_id,
        store=not args.no_store,
    )
    print(json.dumps(result, indent=2))

