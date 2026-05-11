# Directive: Topic Expansion

## Goal
Convert a user-entered topic string into structured learning concepts with difficulty categorization. The output feeds into quiz generation and analytics tagging.

## Inputs
| Input | Type | Source |
|---|---|---|
| `topic` | string | User types a topic, e.g. "Deadlocks in Operating Systems" |

## Execution Script
- `execution/expand_topic.py`

## Process
1. Receive the raw topic string from the backend (`POST /quiz/start`).
2. Call `expand_topic.py` which:
   - Sends the topic to Gemini with a structured prompt.
   - Asks for: a cleaned topic name, a list of core concepts, and a difficulty breakdown categorizing each concept as easy/medium/hard.
   - Validates that the returned JSON matches the expected schema.
   - Stores each concept as a tag in Supabase's `concept_mastery` (upsert, no duplicates).
3. Return the structured result to the backend for quiz scoping.

## Expected Output
```json
{
  "topic": "Deadlocks",
  "concepts": [
    "mutual exclusion",
    "hold and wait",
    "no preemption",
    "circular wait"
  ],
  "difficulty_breakdown": {
    "easy": ["mutual exclusion"],
    "medium": ["hold and wait", "no preemption"],
    "hard": ["circular wait"]
  }
}
```

## Schema Validation Rules
- `topic` must be a non-empty string.
- `concepts` must be a list of ≥ 1 strings.
- `difficulty_breakdown` must have exactly three keys: `easy`, `medium`, `hard`.
- Every concept in the breakdown must appear in the `concepts` list.

## Edge Cases & Learnings
- **Vague topics** (e.g. "Science"): Gemini should return an error message asking the user to be more specific. The script detects this and raises a `ValueError`.
- **Malformed JSON**: Wrap parsing in try/except. On failure, retry once with a stricter "return ONLY valid JSON" prompt.
- **Duplicate concepts**: The Supabase upsert on `concept_mastery` handles this — existing rows are left untouched.
- **Rate limits**: Gemini free tier ≈ 15 RPM. This is a single call per quiz start, so no batching needed.
