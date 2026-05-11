import json

from openai import OpenAI

from app.config import get_settings


def _build_dataset_report_prompt(analysis_json: dict) -> str:
    analysis_payload = json.dumps(analysis_json, ensure_ascii=True)
    return (
        "You are a data quality assistant.\n"
        "Review the dataset analysis JSON and respond in this exact format:\n\n"
        "Summary:\n"
        "- <1-2 concise bullets>\n\n"
        "Risks:\n"
        "- <issue>: <why risky>\n"
        "- <issue>: <why risky>\n"
        "- <issue>: <why risky>\n\n"
        "Fixes:\n"
        "- <specific fix>\n"
        "- <specific fix>\n"
        "- <specific fix>\n\n"
        "Keep the response concise, practical, and under 180 words.\n\n"
        f"Dataset analysis JSON:\n{analysis_payload}"
    )


def generate_dataset_report(analysis_json: dict) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    client = OpenAI(api_key=settings.openai_api_key)
    prompt = _build_dataset_report_prompt(analysis_json)

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=prompt,
        )
        report = response.output_text.strip()
        if not report:
            raise RuntimeError("OpenAI returned an empty report.")
        return report
    except Exception as error:
        raise RuntimeError(f"Failed to generate dataset report: {error}") from error
