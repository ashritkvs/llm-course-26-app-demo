# Directive: Question Generation

## Goal
Generate Socratic quiz questions for a given concept tag and difficulty level. Each question includes three progressive Socratic hints that guide reasoning without revealing the answer, plus an expected reasoning chain.

## Inputs
| Input | Type | Source |
|---|---|---|
| `concept` | string | A concept tag from topic expansion or PDF processing |
| `difficulty` | string (easy / medium / hard) | Set by the adaptive engine or user |
| `number_of_questions` | int | How many questions to generate (default 5) |
| `user_performance` | dict (optional) | User's performance history for this concept from `concept_mastery` — used to avoid repeated question patterns and calibrate difficulty |

## Execution Script
- `execution/generate_questions.py`

## Process
1. Receive concept, difficulty, count, and optional performance history from the backend.
2. If `user_performance` is provided, include it in the prompt context so Gemini can:
   - Avoid question patterns the student has already mastered.
   - Focus on areas where misconceptions were identified.
   - Calibrate difficulty within the specified level.
3. Call `generate_questions.py` which:
   - Builds a structured Gemini prompt requesting Socratic-style questions.
   - Parses and validates the returned JSON.
   - Stores questions in the Supabase `questions` table.
4. Return the generated questions to the backend.

## Expected Output (per question)
```json
{
  "question": "What condition must exist among processes for a deadlock to occur where each process holds a resource needed by the next?",
  "concept_tag": "circular wait",
  "difficulty": "medium",
  "hint_1": "Think about what happens when Process A needs something from Process B, and Process B needs something from Process C...",
  "hint_2": "If you drew arrows between processes showing 'waits for' relationships, what shape would indicate a problem?",
  "hint_3": "Consider a chain of dependencies that loops back to where it started. What is that structure called?",
  "expected_reasoning": [
    "Student recognizes that multiple processes are involved",
    "Student identifies that each process holds a resource another needs",
    "Student connects this to a cycle in resource dependencies",
    "Student concludes this is the circular wait condition"
  ]
}
```

## Socratic Hint Rules
Hints **must** follow Socratic questioning style:
- **Hint 1** — Gentle nudge: a broad, open-ended question that activates prior knowledge.
- **Hint 2** — Focused guidance: a more specific question that narrows the reasoning path.
- **Hint 3** — Strong clue: a question that nearly reveals the answer but still requires the student to make the final connection.
- **NEVER** reveal the answer directly in any hint.
- Hints should build on each other progressively.

## Schema Validation Rules
- `question` must be a non-empty string.
- `concept_tag` must match the input concept.
- `difficulty` must be one of: `easy`, `medium`, `hard`.
- `hint_1`, `hint_2`, `hint_3` must all be non-empty strings.
- `expected_reasoning` must be a list of ≥ 2 strings describing the reasoning steps.

## Edge Cases & Learnings
- **Gemini may return fewer questions** than requested — validate count and retry if needed.
- **Duplicate questions across sessions**: include recent question IDs in the prompt with a "do not repeat" instruction.
- **Performance data is optional**: if not provided, generate standard questions without personalization.
- **Malformed JSON**: Retry once with a stricter prompt on parse failure.
- **Hint quality check**: Hints that contain the answer keyword should be flagged — include a negative instruction: "Hints must NOT contain the exact answer."
