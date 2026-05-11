from collections.abc import Mapping


PROFILE_FIELDS = (
    ("name", "Name"),
    ("age", "Age"),
    ("mental_health_status", "Mental Health Status"),
    ("stress_level", "Stress Level"),
    ("exercise_routine", "Exercise Routine"),
    ("eating_habits", "Eating Habits"),
    ("sleep_hours", "Sleep Hours"),
    ("mood_trends", "Mood Trends"),
    ("social_interaction", "Social Interaction"),
    ("work_pressure", "Work/Study Pressure"),
    ("hobbies", "Hobbies/Relaxation"),
    ("additional_notes", "Additional Notes"),
)


def _format_profile_value(field_name: str, value):
    if value is None or value == "":
        return "Not provided"
    if field_name == "stress_level":
        return f"{value}/10"
    return str(value)


def build_user_profile_context(user_profile: Mapping | None) -> str:
    if not user_profile:
        return "User Profile Context:\n- No stored user profile was found. Use a generic supportive tone."

    lines = ["User Profile Context:"]
    for field_name, label in PROFILE_FIELDS:
        lines.append(f"- {label}: {_format_profile_value(field_name, user_profile.get(field_name))}")
    return "\n".join(lines)


def build_llm_context(user_profile: Mapping | None, journal_text: str) -> str:
    return (
        f"{build_user_profile_context(user_profile)}\n\n"
        f"Journal Entry:\n{journal_text.strip()}"
    )


def build_weekly_context(user_profile: Mapping | None, weekly_summary: str) -> str:
    return (
        f"{build_user_profile_context(user_profile)}\n\n"
        f"Weekly Journal Summary:\n{weekly_summary.strip()}"
    )
