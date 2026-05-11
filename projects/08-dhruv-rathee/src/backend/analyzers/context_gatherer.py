"""
ContextGatherer
===============
Fetches GitHub issue / PR metadata via the REST API.

Requires the env var GITHUB_TOKEN (read-only, public-repo scopes are enough).
If the token is absent, unauthenticated requests are made (60 req/h limit).

Usage
-----
    from backend.analyzers.context_gatherer import ContextGatherer

    cg = ContextGatherer("https://github.com/owner/repo")
    issues = cg.fetch_issues([123, 456])
    for i in issues:
        print(i)
"""

import os
import re
from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class IssueInfo:
    number: int
    title: str
    state: str           # "open" | "closed"
    url: str
    is_pr: bool
    body_snippet: str    # first 300 chars of body
    labels: list[str]


# Extract owner/repo from a GitHub URL
_GITHUB_RE = re.compile(
    r"github\.com[/:](?P<owner>[^/]+)/(?P<repo>[^/. ]+?)(?:\.git)?$"
)


class ContextGatherer:
    API_BASE = "https://api.github.com"

    def __init__(self, repo_url: str) -> None:
        m = _GITHUB_RE.search(repo_url)
        if not m:
            raise ValueError(f"Cannot parse GitHub URL: {repo_url!r}")
        self.owner = m.group("owner")
        self.repo = m.group("repo")
        self._token = os.getenv("GITHUB_TOKEN", "")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch_issues(self, issue_numbers: list[int]) -> list[IssueInfo]:
        """
        Fetch basic info for each issue/PR number.
        Numbers that are not found (404) are silently skipped.
        """
        if not issue_numbers:
            return []

        results: list[IssueInfo] = []
        with httpx.Client(
            headers=self._headers(), timeout=10.0
        ) as client:
            for num in sorted(set(issue_numbers)):
                info = self._fetch_one(client, num)
                if info:
                    results.append(info)
        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _fetch_one(
        self, client: httpx.Client, number: int
    ) -> Optional[IssueInfo]:
        url = f"{self.API_BASE}/repos/{self.owner}/{self.repo}/issues/{number}"
        resp = client.get(url)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()

        body = data.get("body") or ""
        return IssueInfo(
            number=number,
            title=data.get("title", ""),
            state=data.get("state", ""),
            url=data.get("html_url", ""),
            is_pr="pull_request" in data,
            body_snippet=body[:300].replace("\r\n", " ").replace("\n", " "),
            labels=[lbl["name"] for lbl in data.get("labels", [])],
        )

    def _headers(self) -> dict[str, str]:
        h = {"Accept": "application/vnd.github+json"}
        if self._token:
            h["Authorization"] = f"Bearer {self._token}"
        return h
