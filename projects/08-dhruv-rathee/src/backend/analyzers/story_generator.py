"""
StoryGenerator
==============
Builds a compact context string from blame/history/issue data and then
calls an LLM to produce a Markdown narrative.

LLM priority:
  1. Groq API  (if GROQ_API_KEY env var is set)  – fast, cloud
  2. Local Ollama llama3.2  –  http://localhost:11434/api/generate

Usage
-----
    from backend.analyzers.story_generator import StoryGenerator
    from backend.analyzers.blame_analyzer import LineBlame
    from backend.analyzers.history_tracer import CommitInfo
    from backend.analyzers.context_gatherer import IssueInfo

    sg = StoryGenerator()
    narrative = sg.generate(
        file_path="src/utils.py",
        line_range=(10, 40),
        blame_lines=blame_results,
        commits=commit_history,
        issues=issue_info,
    )
    print(narrative)
"""

import json
import os
from typing import Optional

import httpx

from .blame_analyzer import LineBlame
from .context_gatherer import IssueInfo
from .history_tracer import CommitInfo

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"   # best available on Groq free tier

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2"

SYSTEM_PROMPT = """\
You are CodeStory, a code historian. You turn raw git data into a short,
specific, data-grounded narrative. You MUST follow the rules below exactly.

RULES:
1. ONLY state facts present in the provided data. Never invent details.
2. Always reference specific commit SHAs (e.g. `a62a2d3`), author names,
   dates, and issue/PR numbers (e.g. #6724) from the data.
3. Keep it short — each section should be 2-4 sentences max.
4. Commits marked [BLAME] last touched lines in the function. But mass
   formatting/linting commits (running black, prettier, etc.) mask real
   history — identify these by their commit message and call them out.
5. The TRUE origin is usually the OLDEST commit in the timeline.
6. Classify each significant commit as: original authorship, feature,
   bug fix, refactor, formatting, or merge.

OUTPUT FORMAT — use these exact headings, no other sections. Here is an
example of a GOOD narrative:

## Overview
`retry_request()` handles automatic HTTP retry logic with exponential
backoff — the safety net that keeps flaky upstream APIs from causing
user-facing errors.

## Origin
Created by **Mike Chen** in `d4f89a1` (2023-12-15) as an emergency fix
after a production outage caused by upstream API timeouts (#342).

## Key Changes
- `d4f89a1` 2023-12-15 — **Mike Chen** — Original implementation: basic
  retry with fixed 1s delay, added after prod outage (#342)
- `a8bc201` 2024-01-08 — **Sarah Lopez** — Refactored to exponential
  backoff with jitter, max 3 retries (#389)
- `f12e9d3` 2024-03-22 — **Mike Chen** — Bug fix: retry counter wasn't
  resetting between requests (#412)
- `cc71b08` 2024-06-01 — **Priya Nair** — Added circuit breaker pattern
  to avoid hammering failing services (#501)

## Current State
Last meaningful change was `cc71b08` (2024-06-01) adding circuit breaker
logic. The blame is clean — no formatting commits obscuring history. The
function is 45 lines and well-tested.

## Who to Talk To
- **Mike Chen** — 2 commits — original author, retry logic
- **Sarah Lopez** — 1 commit — backoff/jitter design
- **Priya Nair** — 1 commit — circuit breaker pattern

END OF EXAMPLE. Now apply this exact format to the real data below.
"""

MAX_TIMELINE_COMMITS = 20   # cap to keep prompts small
MAX_BLAME_LINES_SAMPLE = 120  # show enough of the function
MAX_CODE_SNIPPET_LINES = 80   # truncated source for the LLM


class StoryGenerator:
    def __init__(self) -> None:
        self._groq_key = os.getenv("GROQ_API_KEY", "").strip()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        file_path: str,
        line_range: tuple[int, int],
        blame_lines: list[LineBlame],
        commits: list[CommitInfo],
        issues: list[IssueInfo],
        function_name: str | None = None,
        code_snippet: str | None = None,
    ) -> str:
        """Return a Markdown narrative string."""
        context = self._build_context(
            file_path, line_range, blame_lines, commits, issues, code_snippet
        )

        if function_name:
            subject = f"the `{function_name}()` function in `{file_path}` (lines {line_range[0]}–{line_range[1]})"
        else:
            subject = f"`{file_path}` lines {line_range[0]}–{line_range[1]}"

        user_msg = (
            f"Here is the git archaeology data for {subject}:\n\n{context}\n\n"
            f"Write the CodeStory narrative for {subject}.\n"
            "IMPORTANT: Reference SPECIFIC commit SHAs, author names, dates, "
            "and issue numbers from the data above. Do NOT write generic prose. "
            "Every claim must trace back to the data provided.\n"
            "Use the exact 5 section headings: Overview, Origin, Key Changes, "
            "Current State, Who to Talk To."
        )

        if self._groq_key:
            print(f"[StoryGenerator] Using Groq ({GROQ_MODEL})")
            return self._call_groq(user_msg)
        print(f"[StoryGenerator] Using local Ollama ({OLLAMA_MODEL})")
        return self._call_ollama(user_msg)

    # ------------------------------------------------------------------
    # Context builder
    # ------------------------------------------------------------------

    def _build_context(
        self,
        file_path: str,
        line_range: tuple[int, int],
        blame_lines: list[LineBlame],
        commits: list[CommitInfo],
        issues: list[IssueInfo],
        code_snippet: str | None = None,
    ) -> str:
        parts: list[str] = []

        # --- Actual source code (truncated) --------------------------------
        if code_snippet:
            snippet_lines = code_snippet.splitlines()
            if len(snippet_lines) > MAX_CODE_SNIPPET_LINES:
                shown = "\n".join(snippet_lines[:MAX_CODE_SNIPPET_LINES])
                shown += f"\n  ... ({len(snippet_lines) - MAX_CODE_SNIPPET_LINES} more lines)"
            else:
                shown = code_snippet
            parts.append(f"### Source code (lines {line_range[0]}–{line_range[1]})\n```\n{shown}\n```")

        # --- Blame sample ------------------------------------------------
        sample = blame_lines[:MAX_BLAME_LINES_SAMPLE]
        if sample:
            blame_text = "\n".join(
                f"  L{l.line_number} [{l.short_sha if hasattr(l, 'short_sha') else l.commit_sha[:7]}]"
                f" {l.author} ({l.timestamp[:10]}): {l.content.strip()}"
                for l in sample
            )
            parts.append(f"### Blame sample (lines {line_range[0]}–{line_range[1]})\n{blame_text}")

        # --- Commit timeline ---------------------------------------------
        recent = commits[:MAX_TIMELINE_COMMITS]
        if recent:
            timeline = "\n".join(
                f"  {'[BLAME] ' if getattr(c, 'in_blame', False) else '        '}"
                f"{c.short_sha}  {c.timestamp[:10]}  {c.author}  "
                f"+{c.additions}/-{c.deletions}  "
                f"{'[' + ','.join(f'#{n}' for n in c.issue_numbers) + '] ' if c.issue_numbers else ''}"
                f"{c.short_message}"
                for c in recent
            )
            parts.append(f"### Commit timeline ({len(commits)} total, showing {len(recent)})\n"
                         f"(Commits marked [BLAME] last touched lines in the function)\n{timeline}")

        # --- Issues / PRs ------------------------------------------------
        if issues:
            issue_lines = "\n".join(
                f"  {'PR' if i.is_pr else 'Issue'} #{i.number} [{i.state}]"
                f" {i.title} – {i.body_snippet[:150]}"
                for i in issues
            )
            parts.append(f"### Referenced Issues / PRs\n{issue_lines}")

        return "\n\n".join(parts)

    # ------------------------------------------------------------------
    # LLM backends
    # ------------------------------------------------------------------

    def _call_groq(self, user_msg: str) -> str:
        payload = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
        }
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                GROQ_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {self._groq_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    def _call_ollama(self, user_msg: str) -> str:
        full_prompt = (
            f"<|system|>\n{SYSTEM_PROMPT}\n"
            f"<|user|>\n{user_msg}\n"
            f"<|assistant|>\n"
        )
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": full_prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 2048},
        }
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(OLLAMA_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip()
