"""
FastAPI backend – CodeStory
===========================

Run:
    cd backend
    uvicorn main:app --reload --port 8000

Endpoints:
    POST /analyze   → full CodeStory analysis
    GET  /health    → sanity check
"""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()  # picks up .env in the current working directory

from analyzers.blame_analyzer import BlameAnalyzer, LineBlame
from analyzers.context_gatherer import ContextGatherer, IssueInfo
from analyzers.history_tracer import CommitInfo, HistoryTracer
from analyzers.story_generator import StoryGenerator

# ---------------------------------------------------------------------------
app = FastAPI(title="CodeStory API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    repo_path: str = Field(..., description="Absolute path to the local git repo")
    file_path: str = Field(..., description="File path relative to repo root")
    function_name: Optional[str] = Field(None, description="Function/method name to analyse")
    start_line: Optional[int] = Field(None, ge=1)
    end_line: Optional[int] = Field(None, ge=1)
    github_repo_url: Optional[str] = Field(
        None, description="e.g. https://github.com/owner/repo (for issue lookup)"
    )
    max_commits: int = Field(50, ge=1, le=500)


class LineBlameOut(BaseModel):
    line_number: int
    content: str
    commit_sha: str
    author: str
    timestamp: str
    message: str


class CommitOut(BaseModel):
    sha: str
    short_sha: str
    author: str
    timestamp: str
    short_message: str
    additions: int
    deletions: int
    issue_numbers: list[int]
    in_blame: bool = False


class IssueOut(BaseModel):
    number: int
    title: str
    state: str
    url: str
    is_pr: bool
    body_snippet: str
    labels: list[str]


class AnalyzeResponse(BaseModel):
    file_path: str
    line_range: tuple[int, int]
    narrative_markdown: str
    timeline: list[CommitOut]
    issues: list[IssueOut]
    blame_sample: list[LineBlameOut]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    # --- Validate repo path ------------------------------------------------
    repo_path = Path(req.repo_path).expanduser().resolve()
    if not (repo_path / ".git").exists():
        raise HTTPException(
            status_code=400,
            detail=f"No git repo found at '{repo_path}'. Make sure repo_path points to the repo root.",
        )

    # --- Validate file exists -----------------------------------------------
    abs_file = repo_path / req.file_path
    if not abs_file.is_file():
        raise HTTPException(
            status_code=400,
            detail=f"File not found: '{req.file_path}'. Check the path is relative to the repo root."
        )

    # --- Determine line range ----------------------------------------------
    blame_analyzer = BlameAnalyzer(str(repo_path))
    total_lines = len(abs_file.read_text(errors='replace').splitlines())

    try:
        if req.function_name:
            start, end = blame_analyzer._find_function_lines(
                req.file_path, req.function_name
            )
        elif req.start_line and req.end_line:
            start = max(1, req.start_line)
            end = min(req.end_line, total_lines)
        else:
            # No function, no lines → analyze the full file (capped at 200)
            start, end = 1, min(total_lines, 200)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if start > end:
        raise HTTPException(status_code=422, detail=f"Invalid range: start ({start}) > end ({end})")

    # --- Blame -------------------------------------------------------------
    try:
        blame_lines: list[LineBlame] = blame_analyzer.blame_lines(
            req.file_path, start, end
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Blame error: {exc}")

    # --- History -----------------------------------------------------------
    # We use BOTH approaches:
    #   1. Full file history  → complete timeline of all commits touching the file
    #   2. Blame SHAs         → highlights which commits last touched each line
    # This avoids the "formatting commit masks real history" problem.
    blame_shas: set[str] = {l.commit_sha for l in blame_lines}

    history_tracer = HistoryTracer(str(repo_path))
    try:
        commits: list[CommitInfo] = history_tracer.commits_for_file(
            req.file_path, max_commits=req.max_commits
        )
        # Tag each commit: was it seen in the blame for the function's lines?
        for c in commits:
            c.in_blame = c.sha in blame_shas  # type: ignore[attr-defined]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"History error: {exc}")

    # --- Issue context -----------------------------------------------------
    issues: list[IssueInfo] = []
    if req.github_repo_url:
        all_issue_nums: set[int] = set()
        for c in commits:
            all_issue_nums.update(c.issue_numbers)
        if all_issue_nums:
            try:
                cg = ContextGatherer(req.github_repo_url)
                issues = cg.fetch_issues(list(all_issue_nums))
            except Exception as exc:
                # Non-fatal: GitHub lookup is best-effort
                print(f"[WARN] GitHub issue fetch failed: {exc}")

    # --- Read actual source code for LLM context --------------------------
    source_lines = abs_file.read_text(errors='replace').splitlines()
    code_snippet = "\n".join(source_lines[start - 1 : end])

    # --- Generate narrative ------------------------------------------------
    sg = StoryGenerator()
    try:
        narrative = sg.generate(
            file_path=req.file_path,
            line_range=(start, end),
            blame_lines=blame_lines,
            commits=commits,
            issues=issues,
            function_name=req.function_name,
            code_snippet=code_snippet,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"LLM error: {exc}")

    # --- Build response ----------------------------------------------------
    timeline_out = [
        CommitOut(
            sha=c.sha,
            short_sha=c.short_sha,
            author=c.author,
            timestamp=c.timestamp,
            short_message=c.short_message,
            additions=c.additions,
            deletions=c.deletions,
            issue_numbers=c.issue_numbers,
            in_blame=getattr(c, "in_blame", False),
        )
        for c in commits
    ]

    issues_out = [
        IssueOut(
            number=i.number,
            title=i.title,
            state=i.state,
            url=i.url,
            is_pr=i.is_pr,
            body_snippet=i.body_snippet,
            labels=i.labels,
        )
        for i in issues
    ]

    blame_out = [
        LineBlameOut(
            line_number=l.line_number,
            content=l.content,
            commit_sha=l.commit_sha,
            author=l.author,
            timestamp=l.timestamp,
            message=l.message,
        )
        for l in blame_lines
    ]

    return AnalyzeResponse(
        file_path=req.file_path,
        line_range=(start, end),
        narrative_markdown=narrative,
        timeline=timeline_out,
        issues=issues_out,
        blame_sample=blame_out,
    )
