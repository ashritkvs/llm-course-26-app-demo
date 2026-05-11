# Directive: Analytics Generation

## Goal
Generate structured learning analytics for a user after quiz completion. The output powers the frontend dashboard charts and the adaptive difficulty engine.

## Inputs
| Input | Type | Source |
|---|---|---|
| `user_id` | string (UUID) | Authenticated user |
| `session_id` | string (UUID, optional) | If provided, compute session-level analytics only; otherwise compute all-time user analytics |

## Execution Script
- `execution/generate_analytics.py`

## Metrics Computed

| Metric | How it's calculated |
|---|---|
| `accuracy` | correct answers / total answers |
| `correct_answers` | count of answers where `correct = true` |
| `wrong_answers` | count of answers where `correct = false` |
| `weak_topics` | concepts with `mastery_score < 0.5` and ≥ 3 attempts |
| `strong_topics` | concepts with `mastery_score > 0.75` and ≥ 3 attempts |
| `avg_reasoning_score` | mean of `reasoning_score` across all answers (0.0–1.0 scale) |
| `hint_usage_rate` | fraction of answers where `hints_used > 0` |
| `avg_response_time` | mean of `response_time` in seconds (null values excluded) |

## Process
1. Receive `user_id` (and optional `session_id`) from the backend.
2. Call `generate_analytics.py` which:
   - Queries the `answers` table (joined with `questions`) for the user/session.
   - Computes all eight metrics above.
   - Queries `concept_mastery` for weak and strong topic classification.
   - Builds a per-concept breakdown with mastery scores and status labels.
   - Computes session-over-session trend data.
3. If `session_id` is provided, also upsert results into `session_analytics`.
4. Return the structured JSON to the backend for the dashboard.

## Expected Output
```json
{
  "user_id": "abc-123",
  "accuracy": 0.72,
  "correct_answers": 18,
  "wrong_answers": 7,
  "weak_topics": [
    { "concept_tag": "circular wait", "mastery_score": 0.35, "attempts": 8 }
  ],
  "strong_topics": [
    { "concept_tag": "mutual exclusion", "mastery_score": 0.88, "attempts": 12 }
  ],
  "avg_reasoning_score": 0.68,
  "hint_usage_rate": 0.40,
  "avg_response_time": 28.5,
  "concept_breakdown": [
    {
      "concept_tag": "mutual exclusion",
      "mastery_score": 0.88,
      "attempts": 12,
      "correct_answers": 10,
      "status": "strong"
    }
  ],
  "session_trend": [
    { "session_id": "...", "accuracy": 0.60, "avg_reasoning_score": 0.55 },
    { "session_id": "...", "accuracy": 0.75, "avg_reasoning_score": 0.70 }
  ]
}
```

## Weak / Strong Classification Rules
- **Weak**: `mastery_score < 0.50` AND `attempts ≥ 3`
- **Strong**: `mastery_score > 0.75` AND `attempts ≥ 3`
- **Developing**: between 0.50 and 0.75 with ≥ 3 attempts
- **Insufficient data**: fewer than 3 attempts — excluded from weak/strong lists

## Edge Cases & Learnings
- **New users (0 attempts)**: Return zeroed metrics with `message: "Take your first quiz to see analytics."`
- **Null response_time**: Exclude from average calculation, don't count as 0.
- **Session-level vs user-level**: When `session_id` is provided, only compute from that session's answers. Otherwise aggregate across all sessions.
- **No weak/strong topics**: Return empty lists rather than omitting the keys.
