#!/usr/bin/env python3
"""
build_s26_json.py

Walks the `projects/` directory, parses each student's project.md
(YAML frontmatter + markdown body), validates the structure, and
produces a single `s26.json` file matching the schema consumed by
the AMS 691.01 Student App Showcase site.

USAGE:
    python build_s26_json.py \\
        --projects-dir ./projects \\
        --output ../ams691-showcase/data/projects/s26.json

    python build_s26_json.py --check          # validate only, no write
    python build_s26_json.py --verbose        # show per-project details

    # Process a single student folder only
    python build_s26_json.py \\
        --only 01-aayush-nair \\
        --output ../ams691-showcase/data/projects/s26.json

DEPENDENCIES:
    pip install python-frontmatter pyyaml

EXIT CODES:
    0  success
    1  validation errors found
    2  invalid command-line arguments or file system error
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

try:
    import frontmatter  # type: ignore
except ImportError:
    sys.stderr.write(
        "ERROR: python-frontmatter is not installed.\n"
        "Install it with: pip install python-frontmatter pyyaml\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Schema definition
# ---------------------------------------------------------------------------

REQUIRED_FRONTMATTER_FIELDS = {
    "slug",
    "title",
    "students",
    "semester",
    "tags",
    "category",
    "tagline",
    "featuredEligible",
}

OPTIONAL_FRONTMATTER_FIELDS = {
    "shortTitle",
    "studentId",
    "videoUrl",
    "thumbnail",
    "githubUrl",
}

ALLOWED_CATEGORIES = {
    "data-analysis",
    "developer-tools",
    "education",
    "enterprise-tools",
    "finance",
    "health",
    "lifestyle",
    "productivity",
    "research",
    "other",
}

REQUIRED_BODY_SECTIONS = [
    "Problem",
    "Solution",
    "User Flow",
    "LLM Components",
    "Tools",
]

# Map exact header text in the .md file to the JSON field name on the site
SECTION_TO_JSON_KEY = {
    "Problem": "problem",
    "Solution": "solution",
    "User Flow": "userFlow",
    "LLM Components": "llmComponents",
    "Tools": "tools",
}

# Final ordering of keys in the output JSON (matches existing s26.json)
OUTPUT_KEY_ORDER = [
    "slug",
    "title",
    "shortTitle",
    "students",
    "studentId",
    "semester",
    "tags",
    "videoUrl",
    "thumbnail",
    "githubUrl",
    "category",
    "tagline",
    "featuredEligible",
    "problem",
    "solution",
    "userFlow",
    "llmComponents",
    "tools",
]

SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
STUDENT_ID_PATTERN = re.compile(r"^\d{9}$")
TAGLINE_MAX_LEN = 100  # soft cap; warn (don't fail) if exceeded


# ---------------------------------------------------------------------------
# Validation result container
# ---------------------------------------------------------------------------

class ProjectErrors:
    """Collects errors and warnings for a single project file."""

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def has_errors(self) -> bool:
        return len(self.errors) > 0


# ---------------------------------------------------------------------------
# Body section parsing
# ---------------------------------------------------------------------------

def parse_body_sections(body: str, errs: ProjectErrors) -> dict[str, str]:
    """
    Split a markdown body into sections by '## Header' lines.

    Returns a dict mapping section header text (without ##) to its body text.
    The body text is stripped of leading/trailing whitespace.
    """
    sections: dict[str, str] = {}
    current_header: str | None = None
    current_lines: list[str] = []

    # Match a level-2 ATX heading: '## Header Text'
    # Allow optional trailing whitespace. Reject deeper levels (### etc.)
    # so that a '### Subsection' inside a body section doesn't split it.
    header_re = re.compile(r"^##\s+(.+?)\s*$")

    for raw_line in body.splitlines():
        m = header_re.match(raw_line)
        if m and not raw_line.startswith("###"):
            # Flush previous section
            if current_header is not None:
                sections[current_header] = "\n".join(current_lines).strip()
            current_header = m.group(1).strip()
            current_lines = []
        else:
            if current_header is not None:
                current_lines.append(raw_line)
            # Lines before the first header are ignored (HTML comments, etc.)

    # Flush final section
    if current_header is not None:
        sections[current_header] = "\n".join(current_lines).strip()

    # Strip HTML comments from all section bodies
    comment_re = re.compile(r"<!--.*?-->", re.DOTALL)
    sections = {k: comment_re.sub("", v).strip() for k, v in sections.items()}

    return sections


# ---------------------------------------------------------------------------
# Frontmatter validation
# ---------------------------------------------------------------------------

def validate_frontmatter(
    fm: dict[str, Any],
    folder_name: str,
    errs: ProjectErrors,
) -> None:
    """Validate the parsed frontmatter dict in-place; appends errors to errs."""

    # 1. Required fields present
    for key in REQUIRED_FRONTMATTER_FIELDS:
        if key not in fm:
            errs.err(f"missing required frontmatter field: '{key}'")
            continue
        # Required string fields must be non-empty
        if key in {"slug", "title", "studentId", "semester", "category", "tagline"}:
            if not isinstance(fm[key], str) or not fm[key].strip():
                errs.err(f"required field '{key}' must be a non-empty string")

    # 2. slug format and folder match
    slug = fm.get("slug")
    if isinstance(slug, str):
        if not SLUG_PATTERN.match(slug):
            errs.err(
                f"invalid slug '{slug}': must be lowercase letters/numbers/hyphens "
                f"(e.g. 'meeting-intelligence')"
            )
        if slug != folder_name:
            errs.err(
                f"slug '{slug}' does not match folder name '{folder_name}'. "
                f"They must be identical."
            )

    # 3. students must be a non-empty list of non-empty strings
    students = fm.get("students")
    if students is not None:
        if not isinstance(students, list) or not students:
            errs.err("'students' must be a non-empty YAML list")
        else:
            for i, s in enumerate(students):
                if not isinstance(s, str) or not s.strip():
                    errs.err(f"'students[{i}]' must be a non-empty string")

    # 4. studentId: 9-digit string (optional — only validate if present)
    sid = fm.get("studentId")
    if sid is not None and sid != "":
        if not isinstance(sid, str):
            errs.err(
                f"'studentId' must be a string (wrap in quotes). "
                f"Got type {type(sid).__name__}."
            )
        elif not STUDENT_ID_PATTERN.match(sid):
            errs.err(f"'studentId' must be exactly 9 digits, got '{sid}'")

    # 5. tags: list of 3-5 lowercase strings (warn if outside range)
    tags = fm.get("tags")
    if tags is not None:
        if not isinstance(tags, list):
            errs.err("'tags' must be a YAML list")
        else:
            if not (3 <= len(tags) <= 5):
                errs.warn(f"recommended 3-5 tags, found {len(tags)}")
            for i, t in enumerate(tags):
                if not isinstance(t, str):
                    errs.err(f"'tags[{i}]' must be a string")
                elif t != t.lower():
                    errs.warn(f"tag '{t}' should be lowercase")
                elif " " in t:
                    errs.warn(f"tag '{t}' contains a space; use hyphens instead")

    # 6. category must be from the allowed set
    cat = fm.get("category")
    if isinstance(cat, str) and cat not in ALLOWED_CATEGORIES:
        errs.err(
            f"invalid category '{cat}'. Must be one of: "
            f"{', '.join(sorted(ALLOWED_CATEGORIES))}"
        )

    # 7. tagline length (soft warning)
    tagline = fm.get("tagline")
    if isinstance(tagline, str) and len(tagline) > TAGLINE_MAX_LEN:
        errs.warn(
            f"tagline is {len(tagline)} chars (recommended ≤80, hard cap {TAGLINE_MAX_LEN})"
        )

    # 8. featuredEligible must be a real boolean (not "true"/"false" string)
    fe = fm.get("featuredEligible")
    if fe is not None and not isinstance(fe, bool):
        errs.err(
            f"'featuredEligible' must be a YAML boolean (true/false, no quotes). "
            f"Got {type(fe).__name__}: {fe!r}"
        )

    # 9. semester (lock to expected value)
    sem = fm.get("semester")
    if isinstance(sem, str) and sem != "Spring 2026":
        errs.warn(f"'semester' is '{sem}', expected 'Spring 2026'")

    # 10. Reject unknown frontmatter keys (catches typos)
    known = REQUIRED_FRONTMATTER_FIELDS | OPTIONAL_FRONTMATTER_FIELDS
    for key in fm.keys():
        if key not in known:
            errs.warn(f"unknown frontmatter key '{key}' will be ignored")


# ---------------------------------------------------------------------------
# Body validation
# ---------------------------------------------------------------------------

def validate_body(sections: dict[str, str], errs: ProjectErrors) -> None:
    """Validate that all required sections are present and non-empty."""
    for header in REQUIRED_BODY_SECTIONS:
        if header not in sections:
            errs.err(f"missing required body section: '## {header}'")
        elif not sections[header].strip():
            errs.err(f"body section '## {header}' is empty")

    # Flag unknown extra sections (allowlist: required + optional 'Notes')
    allowed_extras = {"Notes"}
    for header in sections.keys():
        if header not in REQUIRED_BODY_SECTIONS and header not in allowed_extras:
            errs.warn(f"unknown body section '## {header}' will be ignored")


# ---------------------------------------------------------------------------
# Project assembly
# ---------------------------------------------------------------------------

def build_project_dict(
    fm: dict[str, Any], sections: dict[str, str]
) -> dict[str, Any]:
    """
    Combine frontmatter and body sections into a single project dict
    matching the s26.json schema, in the canonical key order.
    """
    out: dict[str, Any] = {}

    # Copy frontmatter fields (skip empty optional fields)
    for key in OUTPUT_KEY_ORDER:
        if key in SECTION_TO_JSON_KEY.values():
            continue  # body fields handled below
        if key not in fm:
            continue
        value = fm[key]
        # Skip empty optional fields entirely
        if key in OPTIONAL_FRONTMATTER_FIELDS:
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
        out[key] = value

    # Copy body sections
    for header, json_key in SECTION_TO_JSON_KEY.items():
        if header in sections:
            out[json_key] = sections[header].strip()

    # Re-sort by canonical order
    sorted_out = {k: out[k] for k in OUTPUT_KEY_ORDER if k in out}
    return sorted_out


# ---------------------------------------------------------------------------
# Per-file processing
# ---------------------------------------------------------------------------

def process_file(md_path: Path, verbose: bool) -> tuple[dict[str, Any] | None, ProjectErrors]:
    """
    Parse and validate a single project.md file.
    Returns (project_dict_or_None, errors). project_dict is None if the file
    has any errors.
    """
    errs = ProjectErrors(md_path)

    try:
        post = frontmatter.load(md_path)
    except Exception as e:
        errs.err(f"failed to parse frontmatter: {e}")
        return None, errs

    fm = dict(post.metadata) if post.metadata else {}
    body = post.content or ""

    folder_name = md_path.parent.name
    validate_frontmatter(fm, folder_name, errs)

    sections = parse_body_sections(body, errs)
    validate_body(sections, errs)

    if errs.has_errors():
        return None, errs

    project = build_project_dict(fm, sections)
    if verbose:
        sys.stdout.write(f"  ✓ {folder_name} (slug={project.get('slug')})\n")
    return project, errs


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def print_report(all_errs: list[ProjectErrors], total_files: int) -> None:
    n_with_errors = sum(1 for e in all_errs if e.has_errors())
    n_with_warnings = sum(1 for e in all_errs if e.warnings and not e.has_errors())

    sys.stdout.write("\n" + "=" * 60 + "\n")
    sys.stdout.write(f"Processed {total_files} project file(s).\n")
    sys.stdout.write(f"  Errors:   {n_with_errors}\n")
    sys.stdout.write(f"  Warnings: {n_with_warnings}\n")
    sys.stdout.write("=" * 60 + "\n")

    for e in all_errs:
        if not e.errors and not e.warnings:
            continue
        rel = e.file_path
        sys.stdout.write(f"\n{rel}\n")
        for msg in e.errors:
            sys.stdout.write(f"  ERROR:   {msg}\n")
        for msg in e.warnings:
            sys.stdout.write(f"  warning: {msg}\n")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build s26.json from student project.md files."
    )
    parser.add_argument(
        "--projects-dir",
        type=Path,
        default=Path("projects"),
        help="Directory containing one subfolder per project (default: ./projects)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/projects/s26.json"),
        help="Output JSON file path (default: ./data/projects/s26.json)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate only; do not write the output file",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print per-project status messages",
    )
    parser.add_argument(
        "--only",
        metavar="FOLDER",
        nargs="+",
        help="Process only the specified folder name(s), e.g. --only 00-demo-solha-park",
    )
    args = parser.parse_args()

    if not args.projects_dir.is_dir():
        sys.stderr.write(
            f"ERROR: projects directory does not exist: {args.projects_dir}\n"
        )
        return 2

    # Find all project.md files exactly one level deep:
    #   projects/<slug>/project.md
    md_files = sorted(args.projects_dir.glob("*/project.md"))

    if args.only:
        md_files = [f for f in md_files if f.parent.name in args.only]

    if not md_files:
        sys.stderr.write(
            f"ERROR: no projects found under {args.projects_dir}/*/project.md\n"
        )
        return 2

    if args.verbose:
        sys.stdout.write(f"Found {len(md_files)} project file(s).\n\n")

    projects: list[dict[str, Any]] = []
    all_errs: list[ProjectErrors] = []
    seen_slugs: dict[str, Path] = {}

    for md_path in md_files:
        project, errs = process_file(md_path, args.verbose)
        all_errs.append(errs)
        if project is not None:
            slug = project["slug"]
            if slug in seen_slugs:
                errs.err(
                    f"duplicate slug '{slug}' (also used by {seen_slugs[slug]})"
                )
            else:
                seen_slugs[slug] = md_path
                projects.append(project)

    print_report(all_errs, len(md_files))

    has_any_errors = any(e.has_errors() for e in all_errs)

    if has_any_errors:
        sys.stdout.write("\nNot writing output: validation errors found.\n")
        return 1

    if args.check:
        sys.stdout.write("\n--check mode: validation passed, no file written.\n")
        return 0

    # Sort projects by slug for stable output
    projects.sort(key=lambda p: p["slug"])

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(projects, f, indent=4, ensure_ascii=False)
        f.write("\n")  # trailing newline

    sys.stdout.write(f"\nWrote {len(projects)} project(s) → {args.output}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
