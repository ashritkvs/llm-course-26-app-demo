"""
BlameAnalyzer
=============
Uses PyGit2 to:
  1. Find the line range for a named function inside a file (best-effort
     text scan; covers Python, JS/TS, Go, Java, Rust, C/C++).
  2. Run git-blame on a specific line range and return per-line commit info.

Usage (standalone test)
-----------------------
    from backend.analyzers.blame_analyzer import BlameAnalyzer

    ba = BlameAnalyzer("/abs/path/to/repo")
    lines = ba.blame_lines("src/utils.py", start=10, end=30)
    for l in lines:
        print(l)

    # Or let it auto-detect the function's line range:
    lines = ba.blame_function("src/utils.py", "my_function")
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pygit2


@dataclass
class LineBlame:
    line_number: int
    content: str
    commit_sha: str
    author: str
    author_email: str
    timestamp: str   # ISO-8601
    message: str     # first line of commit message


class BlameAnalyzer:
    def __init__(self, repo_path: str) -> None:
        self.repo_path = str(Path(repo_path).resolve())
        self.repo = pygit2.Repository(self.repo_path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def blame_function(
        self,
        file_path: str,
        function_name: str,
    ) -> list[LineBlame]:
        """
        Auto-detect the start/end lines of *function_name* in *file_path*
        (relative to repo root), then run blame on that range.
        """
        start, end = self._find_function_lines(file_path, function_name)
        return self.blame_lines(file_path, start, end)

    def blame_lines(
        self,
        file_path: str,
        start: int,
        end: int,
    ) -> list[LineBlame]:
        """
        Run git-blame on lines [start, end] (1-indexed, inclusive).
        Returns one LineBlame per line.
        """
        blame = self.repo.blame(
            file_path,
            min_line=start,
            max_line=end,
        )

        # Read the file content to attach line text
        abs_path = Path(self.repo_path) / file_path
        try:
            file_lines = abs_path.read_text(errors="replace").splitlines()
        except OSError:
            file_lines = []

        results: list[LineBlame] = []
        for hunk in blame:
            commit = self.repo.get(hunk.final_commit_id)
            if commit is None:
                continue

            # pygit2 >= 1.15 uses final_committer (Signature); fall back to
            # the commit's author if the hunk attribute is unavailable.
            sig = getattr(hunk, "final_committer", None) or commit.author
            ts = datetime.fromtimestamp(sig.time, tz=timezone.utc).isoformat()

            for i in range(hunk.lines_in_hunk):
                line_no = hunk.final_start_line_number + i
                content = (
                    file_lines[line_no - 1] if line_no <= len(file_lines) else ""
                )
                results.append(
                    LineBlame(
                        line_number=line_no,
                        content=content,
                        commit_sha=str(hunk.final_commit_id),
                        author=sig.name,
                        author_email=sig.email,
                        timestamp=ts,
                        message=commit.message.splitlines()[0],
                    )
                )

        results.sort(key=lambda x: x.line_number)
        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    # Patterns to detect function / method definitions.
    # We match the opening line of the function and then walk forward to
    # find where the body ends (via indentation for Python, braces for others).
    _FUNC_PATTERNS = [
        # Python
        re.compile(r"^\s*(?:async\s+)?def\s+(\w+)\s*\("),
        # JS / TS: function foo(, async function foo(, const foo = (...) =>
        re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\("),
        re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\("),
        # Go
        re.compile(r"^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\("),
        # Java / C# / Kotlin: return-type name(
        re.compile(r"^\s*(?:public|private|protected|static|override|\w+)*\s+\w+\s+(\w+)\s*\("),
        # Rust
        re.compile(r"^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]"),
        # C / C++
        re.compile(r"^\w[\w\s\*]+\s+(\w+)\s*\("),
    ]

    def _find_function_lines(
        self, file_path: str, function_name: str
    ) -> tuple[int, int]:
        """
        Return (start_line, end_line) of *function_name* in *file_path*.
        Both are 1-indexed.  Raises ValueError if not found.

        When a file has multiple definitions with the same name (e.g. a
        stub in a base class and the real implementation in a subclass),
        we pick the **longest** one — the most substantial implementation.
        """
        abs_path = Path(self.repo_path) / file_path
        source = abs_path.read_text(errors="replace")
        lines = source.splitlines()

        # Collect ALL matching definitions
        candidates: list[tuple[int, int]] = []
        for idx, line in enumerate(lines, start=1):
            for pat in self._FUNC_PATTERNS:
                m = pat.match(line)
                if m and m.group(1) == function_name:
                    start = idx
                    end = self._find_end_line(lines, start - 1)
                    candidates.append((start, end))
                    break  # don't match the same line with another pattern

        if not candidates:
            raise ValueError(
                f"Function '{function_name}' not found in '{file_path}'"
            )

        # Pick the longest (most substantial) definition
        candidates.sort(key=lambda se: se[1] - se[0], reverse=True)
        return candidates[0]

    def _find_end_line(self, lines: list[str], start_idx: int) -> int:
        """
        Walk from *start_idx* (0-based) until the function body ends.
        Strategy:
          - Python: track indentation level drop back to the start indent.
          - Everything else: count braces { }.
        """
        opening_line = lines[start_idx]
        is_python = opening_line.lstrip().startswith(("def ", "async def "))

        if is_python:
            return self._find_python_end(lines, start_idx)
        return self._find_brace_end(lines, start_idx)

    def _find_python_end(self, lines: list[str], start_idx: int) -> int:
        base_indent = len(lines[start_idx]) - len(lines[start_idx].lstrip())

        # Step 1: Skip past the function signature (may span multiple lines).
        # The signature ends at the first line containing the closing "):".
        body_start = start_idx + 1
        if "):" not in lines[start_idx]:
            for i in range(start_idx + 1, len(lines)):
                if "):" in lines[i]:
                    body_start = i + 1
                    break

        # Step 2: Walk the body — it ends when we hit a non-blank line whose
        # indentation is back at (or before) the original def's level.
        end = body_start
        for i in range(body_start, len(lines)):
            l = lines[i]
            if l.strip() == "":
                continue
            indent = len(l) - len(l.lstrip())
            if indent <= base_indent:
                end = i  # this line is already outside the function
                break
            end = i + 1
        return min(end, len(lines))

    def _find_brace_end(self, lines: list[str], start_idx: int) -> int:
        depth = 0
        found_open = False
        for i in range(start_idx, len(lines)):
            for ch in lines[i]:
                if ch == "{":
                    depth += 1
                    found_open = True
                elif ch == "}":
                    depth -= 1
                    if found_open and depth == 0:
                        return i + 1  # 1-indexed
        return len(lines)
