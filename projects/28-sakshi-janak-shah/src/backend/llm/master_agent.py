from llm.client import call_json
from llm.personalization import build_llm_context


def analyze_all(journal_text, user_profile=None):
    prompt = f"""
You are a CBT journaling assistant.
Analyze the journal entry with concise, realistic language.
Return valid JSON only.

User Context:
{build_llm_context(user_profile, journal_text)}

Journal Entry:
\"\"\"{journal_text}\"\"\"

Return exactly this JSON shape:
{{
  "emotion": "primary emotion",
  "intensity": 1,
  "category": "positive",
  "trigger": "main trigger or stressor",
  "thinking_patterns": [],
  "distortion": "main cognitive distortion or empty string",
  "reframes": [],
  "core_insight": "short insight",
  "reflection_question": "one reflective question",
  "action_plan": "one practical next step",
  "key_concerns": [],
  "positive_signals": [],
  "personalized_suggestions": [],
  "actions": []
}}

Rules:
- category must be one of: "positive", "negative", "neutral"
- intensity must be an integer from 1 to 10
- arrays should contain 0 to 3 short strings
- keep every value brief and specific
- no markdown, no explanation, no code fences
"""
    return call_json(prompt)
