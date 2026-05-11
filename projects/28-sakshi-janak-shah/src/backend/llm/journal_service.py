import pandas as pd

from llm.client import call_text
from llm.personalization import build_llm_context, build_weekly_context


def summarize_journal(journal_text: str, user_profile=None) -> str:
    prompt = f"""
You are a mental health journaling assistant.

Here is the user's background:
{build_llm_context(user_profile, journal_text)}

Summarize today's journal entry in 3-5 sentences.
Focus on the user's emotional state, main stressors, and any progress signals.
Be personalized to their lifestyle and habits when profile data exists.
"""

    return call_text(prompt)


def generate_recommendations(journal_text: str, user_profile=None) -> str:
    prompt = f"""
You are a supportive mental wellness coach.

Here is the user's background:
{build_llm_context(user_profile, journal_text)}

Provide 3-5 personalized recommendations based on:
- their journal entry
- their stress level
- their routines and habits

Rules:
- Be practical
- Keep each recommendation short
- Avoid generic advice
- If profile fields are missing, use only what is available
"""

    return call_text(prompt)


def generate_insights(df: pd.DataFrame, user_profile=None) -> str:
    if df.empty:
        return "Not enough journal history to generate personalized insights."

    avg_mood = round(df["mood_score"].mean(), 2)
    top_emotion = "unknown"
    emotion_mode = df["emotion"].dropna().mode()
    if not emotion_mode.empty:
        top_emotion = emotion_mode.iloc[0]

    top_trigger = "unknown"
    trigger_mode = df["trigger"].dropna().mode()
    if not trigger_mode.empty:
        top_trigger = trigger_mode.iloc[0]

    summary = f"""
- Average mood over the last 7 days: {avg_mood}
- Most frequent emotion: {top_emotion}
- Most frequent trigger: {top_trigger}
- Number of entries analyzed: {len(df)}
"""

    prompt = f"""
You are a mental wellness insights assistant.

{build_weekly_context(user_profile, summary)}

Provide:
1. The most important pattern you see
2. Why it may be happening for this user specifically
3. One encouraging observation
4. Two personalized next steps
"""

    return call_text(prompt)
