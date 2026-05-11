# Directive: Answer Evaluation

## Goal
Evaluate a student's answer against the question and expected reasoning chain. Detect misconceptions, score reasoning quality, and store results. Evaluation uses Gemini to go beyond simple string matching — it assesses *how* the student reasoned, not just *what* they answered.

## Inputs
| Input | Type | Source |
|---|---|---|
| `question` | dict | Full question object (question text, concept_tag, difficulty, hints) |
| `expected_reasoning` | list[str] | The expected reasoning chain from question generation |
| `student_answer` | string | The student's submitted answer |

## Execution Script
- `execution/evaluate_answer.py`

## Process
1. Receive the question, expected reasoning, and student answer from the backend (`POST /quiz/answer`).
2. Call `evaluate_answer.py` which sends a structured prompt to Gemini including:
   - The question text
   - The expected reasoning steps
   - The student's answer
3. Gemini evaluates and returns:
   - Whether the answer is correct
   - A reasoning score (1–5)
   - Any misconceptions detected
   - The concept tag for analytics tracking
4. Validate the response schema.
5. Store the result in the Supabase `answers` table.
6. Update `concept_mastery` for the user.
7. Return the evaluation to the frontend.

## Expected Output
```json
{
  "correct": true,
  "reasoning_score": 4,
  "misconceptions": [],
  "concept_tag": "circular wait"
}
```

When incorrect:
```json
{
  "correct": false,
  "reasoning_score": 2,
  "misconceptions": [
    "Confuses deadlock with starvation",
    "Believes mutual exclusion alone causes deadlock"
  ],
  "concept_tag": "circular wait"
}
```

## Reasoning Score Scale
| Score | Meaning |
|---|---|
| 1 | No understanding — answer is unrelated or random |
| 2 | Minimal understanding — recognizes the topic but reasoning is flawed |
| 3 | Partial understanding — some correct reasoning but key gaps |
| 4 | Strong understanding — mostly correct with minor gaps |
| 5 | Full understanding — correct answer with complete, well-structured reasoning |

## Schema Validation Rules
- `correct` must be a boolean.
- `reasoning_score` must be an integer from 1 to 5.
- `misconceptions` must be a list of strings (can be empty if correct).
- `concept_tag` must be a non-empty string matching the question's concept.

## Edge Cases & Learnings
- **Simple MCQ**: For multiple-choice, still use Gemini to detect *why* the wrong option was chosen (misconception detection), rather than just doing a string match.
- **Empty answers**: If student_answer is empty or whitespace, return `correct: false, reasoning_score: 1, misconceptions: ["No answer provided"]`.
- **Gemini hallucinating misconceptions**: Include in the prompt: "Only list misconceptions that are clearly evidenced by the student's answer."
- **Malformed JSON from Gemini**: Retry once with a stricter prompt on parse failure.
