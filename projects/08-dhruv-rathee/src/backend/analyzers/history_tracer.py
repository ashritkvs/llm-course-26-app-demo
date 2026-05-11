"""
HistoryTracer
=============
Uses PyGit2 to walk the commit history and collect every commit that
touched a given file.  For each commit it extracts:

  - SHA, author, timestamp, message
  - Files changed (names only)
  - Additions / deletions for the target file
  - Issue / PR numbers referenced in the commit message

Usage
-----
    from backend.analyzers.history_tracer import HistoryTracer

    ht = HistoryTracer("/abs/path/to/repo")
    commits = ht.commits_for_file("src/utils.py", max_commits=50)
    for c in commits:
        print(c)
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pygit2


# Matches things like: #123, fixes #456, closes #789, resolves #12
_ISSUE_RE = re.compile(r"(?:fixes|closes|resolves|ref|see)?\s*#(\d+)", re.IGNORECASE)


@dataclass
class CommitInfo:
    sha: str
    short_sha: str
    author: str
    author_email: str
    timestamp: str       # ISO-8601
    message: str         # full message
    short_message: str   # first line only
    files_changed: list[str] = field(default_factory=list)
    additions: int = 0
    deletions: int = 0
    issue_numbers: list[int] = field(default_factory=list)
    in_blame: bool = False  # True if this commit appears in the blame output


class HistoryTracer:
    def __init__(self, repo_path: str) -> None:
        self.repo_path = str(Path(repo_path).resolve())
        self.repo = pygit2.Repository(self.repo_path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def commits_for_file(
        self,
        file_path: str,
        max_commits: int = 100,
    ) -> list[CommitInfo]:
        """
        Return the *max_commits* most-recent commits that touched *file_path*
        (relative to repo root), newest first.
        """
        results: list[CommitInfo] = []

        for commit in self.repo.walk(
            self.repo.head.target, pygit2.GIT_SORT_TIME
        ):
            if len(results) >= max_commits:
                break

            if not self._commit_touches_file(commit, file_path):
                continue

            info = self._extract_commit_info(commit, file_path)
            results.append(info)

        return results

    def commits_in_sha_set(
        self,
        sha_set: set[str],
        file_path: str,
    ) -> list[CommitInfo]:
        """
        Return CommitInfo objects for all commits whose SHA is in sha_set.
        Useful to enrich blame results.
        """
        results: list[CommitInfo] = []
        visited: set[str] = set()

        for commit in self.repo.walk(
            self.repo.head.target, pygit2.GIT_SORT_TIME
        ):
            sha = str(commit.id)
            if sha in sha_set and sha not in visited:
                visited.add(sha)
                results.append(self._extract_commit_info(commit, file_path))
            if visited == sha_set:
                break

        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _commit_touches_file(self, commit: pygit2.Commit, file_path: str) -> bool:
        """Return True if *file_path* appears in the diff of *commit*."""
        if not commit.parents:
            # Initial commit: check if file exists in tree
            return file_path in self._tree_paths(commit.tree)

        parent = commit.parents[0]
        diff = self.repo.diff(parent, commit)
        return any(
            delta.new_file.path == file_path or delta.old_file.path == file_path
            for delta in diff.deltas
        )

    def _extract_commit_info(
        self, commit: pygit2.Commit, file_path: str
    ) -> CommitInfo:
        sha = str(commit.id)
        sig = commit.author
        ts = datetime.fromtimestamp(sig.time, tz=timezone.utc).isoformat()
        message = commit.message.strip()
        short_msg = message.splitlines()[0]

        # Diff stats for the target file
        additions, deletions, files_changed = 0, 0, []
        if commit.parents:
            diff = self.repo.diff(commit.parents[0], commit)
            diff.find_similar()
            for delta in diff.deltas:
                files_changed.append(delta.new_file.path)
            for patch in diff:
                if (
                    patch.delta.new_file.path == file_path
                    or patch.delta.old_file.path == file_path
                ):
                    additions = patch.line_stats[1]
                    deletions = patch.line_stats[2]

        issue_numbers = [int(n) for n in _ISSUE_RE.findall(message)]

        return CommitInfo(
            sha=sha,
            short_sha=sha[:7],
            author=sig.name,
            author_email=sig.email,
            timestamp=ts,
            message=message,
            short_message=short_msg,
            files_changed=files_changed,
            additions=additions,
            deletions=deletions,
            issue_numbers=issue_numbers,
        )

    def _tree_paths(self, tree: pygit2.Tree, prefix: str = "") -> set[str]:
        paths: set[str] = set()
        for entry in tree:
            full = f"{prefix}{entry.name}" if not prefix else f"{prefix}/{entry.name}"
            if entry.type_str == "tree":
                paths |= self._tree_paths(self.repo.get(entry.id), full)
            else:
                paths.add(full)
        return paths
