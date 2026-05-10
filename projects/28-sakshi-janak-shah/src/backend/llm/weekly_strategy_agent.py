import pandas as pd

from llm.client import call_text
from llm.personalization import build_weekly_context


def generate_weekly_strategy(df: pd.DataFrame, user_profile=None):
    if df.empty:
        return "Not enough data to generate strategy."

    avg_mood = round(df["mood_score"].mean(), 2)
    negative_ratio = round(float((df["category"] == "negative").mean()), 2)

    top_emotion = "unknown"
    if "emotion" in df.columns:
        emotion_mode = df["emotion"].dropna().mode()
        if not emotion_mode.empty:
            top_emotion = emotion_mode.iloc[0]

    top_trigger = "unknown"
    if "trigger" in df.columns:
        trigger_mode = df["trigger"].dropna().mode()
        if not trigger_mode.empty:
            top_trigger = trigger_mode.iloc[0]

    df = df.copy()
    df["signed_score"] = df.apply(
        lambda row: row["mood_score"] if row["category"] == "positive" else -row["mood_score"],
        axis=1,
    )

    first_score = df["signed_score"].iloc[0]
    last_score = df["signed_score"].iloc[-1]
    if last_score > first_score:
        trend = "improving"
    elif last_score < first_score:
        trend = "declining"
    else:
        trend = "stable"

    weekly_summary = f"""
Weekly Summary:
- Average mood: {avg_mood}
- Negative ratio: {negative_ratio}
- Most frequent emotion: {top_emotion}
- Most common trigger: {top_trigger}
- Trend: {trend}
"""

    prompt = f"""
You are a behavioral strategist for a journaling assistant.

{build_weekly_context(user_profile, weekly_summary)}

Provide:
1. Key pattern
2. Likely cause
3. 3 actionable strategies for next week

Rules:
- Be concise
- Be specific
- Use the user's profile context when available
- Avoid generic advice
- Focus on behavior change

Format:
Pattern:
Cause:
Strategy:
"""

    return call_text(prompt)
