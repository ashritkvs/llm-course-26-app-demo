from groq import Groq
import json
import os

client = Groq(api_key=os.environ["GROQ_API_KEY"])

PROMPT_TEMPLATE = """
You are a professional resume analyst and ATS expert.

Given the resume and job description below, return ONLY a valid JSON object with this exact structure (no markdown, no extra text):

{{
  "match_score": <integer 0-100>,
  "missing_keywords": [
    {{
      "keyword": "<keyword from JD missing in resume>",
      "where_to_add": "<section name from resume like Experience, Skills, Projects>",
      "suggestion": "<one sentence on how to naturally incorporate this keyword>"
    }}
  ],
  "bullet_changes": [
    {{
      "section": "<section name where this bullet exists>",
      "original": "<exact original bullet text from the resume>",
      "improved": "<rewritten bullet tailored to this JD>",
      "keywords_added": ["<keyword1>", "<keyword2>"]
    }}
  ],
  "ats_tips": ["<tip1>", "<tip2>", "<tip3>"]
}}

RESUME:
{resume}

JOB DESCRIPTION:
{jd}
"""

def analyze_resume(resume_text: str, job_description: str) -> dict:
    prompt = PROMPT_TEMPLATE.format(resume=resume_text, jd=job_description)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())