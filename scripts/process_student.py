"""
process_student.py
==================

Post-processing script that handles one student's submission end-to-end
after their PR has been merged on GitHub.

Prerequisites:
  1. The student's PR must already be merged on GitHub.
  2. The local llm-course-26-app-demo repo must be up-to-date ('git pull' done).
  3. The student's thumbnail image must already be saved to
     ams691-showcase/public/thumbnails/[slug].[ext]
     (any of: .jpg, .jpeg, .png, .webp, .gif)

Usage:
  python process_student.py 02-aditya-nahush-patel

Output is intentionally minimal:
  - On success: prints the git commands you need to run.
  - On validation error: prints ONLY the error lines for this student,
    wrapped so you can copy-paste straight into a PR comment.
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

# --- Path setup ---------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
DEMO_REPO = SCRIPT_DIR.parent
WORKSPACE = DEMO_REPO.parent
SHOWCASE_REPO = WORKSPACE / "ams691-showcase"

PROJECTS_DIR = DEMO_REPO / "projects"
BUILD_SCRIPT = DEMO_REPO / "scripts" / "build_s26_json.py"
THUMBNAILS_DIR = SHOWCASE_REPO / "public" / "thumbnails"
S26_JSON = SHOWCASE_REPO / "data" / "projects" / "s26.json"

ALLOWED_THUMBNAIL_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"]


# --- Tiny print helpers -------------------------------------------------
def ok(msg: str) -> None:
    print(f"[OK]  {msg}")

def err(msg: str) -> None:
    print(f"[ERR] {msg}")


# --- Step 1: detect thumbnail extension ---------------------------------
def detect_thumbnail_ext(slug: str) -> str:
    if not THUMBNAILS_DIR.exists():
        err(f"thumbnails folder missing: {THUMBNAILS_DIR}")
        sys.exit(1)

    found = [
        ext for ext in ALLOWED_THUMBNAIL_EXTS
        if (THUMBNAILS_DIR / f"{slug}{ext}").exists()
    ]
    if not found:
        err(f"No thumbnail for '{slug}' in {THUMBNAILS_DIR}")
        err(f"Expected one of: {', '.join(slug + e for e in ALLOWED_THUMBNAIL_EXTS)}")
        sys.exit(1)

    return found[0]


# --- Step 2: project.md auto-fixes --------------------------------------
def fix_project_md(slug: str, thumbnail_ext: str) -> None:
    md_path = PROJECTS_DIR / slug / "project.md"
    if not md_path.exists():
        err(f"project.md not found: {md_path}")
        err(f"Did you run 'git pull' in {DEMO_REPO}?")
        sys.exit(1)

    content = md_path.read_text(encoding="utf-8")
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if not fm_match:
        # No frontmatter -> just let the validator catch it and print errors.
        return

    fm_text = fm_match.group(1)
    body = content[fm_match.end():]
    changed = False

    # --- thumbnail ---
    new_thumbnail = f"/thumbnails/{slug}{thumbnail_ext}"
    thumbnail_pattern = re.compile(r"^thumbnail:\s*.*$", re.MULTILINE)
    if thumbnail_pattern.search(fm_text):
        old = thumbnail_pattern.search(fm_text).group(0)
        new = f"thumbnail: {new_thumbnail}"
        if old != new:
            fm_text = thumbnail_pattern.sub(new, fm_text)
            changed = True
    else:
        fm_text += f"\nthumbnail: {new_thumbnail}"
        changed = True

    # --- semester quotes ---
    semester_pattern = re.compile(r'^semester:\s*(.+)$', re.MULTILINE)
    sem_match = semester_pattern.search(fm_text)
    if sem_match:
        sem_value = sem_match.group(1).strip()
        if not (sem_value.startswith('"') and sem_value.endswith('"')):
            fm_text = semester_pattern.sub(f'semester: "{sem_value}"', fm_text)
            changed = True

    if changed:
        md_path.write_text(f"---\n{fm_text}\n---\n{body}", encoding="utf-8")


# --- Step 3: extract error lines for this student only ------------------
def extract_student_errors(stdout: str, slug: str) -> list[str]:
    """
    Parse build_s26_json.py output and return the ERROR/warning lines
    that belong to projects/[slug]/project.md.
    """
    lines = stdout.splitlines()
    student_lines: list[str] = []
    capturing = False

    # Match Windows or POSIX path
    target_prefixes = (
        f"projects/{slug}/project.md",
        f"projects\\{slug}\\project.md",
    )

    for line in lines:
        stripped = line.strip()

        # A new "projects/...project.md" header starts a new student block
        if stripped.startswith("projects/") or stripped.startswith("projects\\"):
            capturing = stripped.startswith(target_prefixes)
            continue

        # Stop capturing at a blank line or a "Not writing output" footer
        if capturing:
            if not stripped:
                capturing = False
                continue
            if stripped.startswith("Not writing output"):
                capturing = False
                continue
            # Only keep ERROR / warning lines
            if stripped.startswith("ERROR:") or stripped.startswith("warning:"):
                student_lines.append(stripped)

    return student_lines


# --- Step 4: run build_s26_json.py --------------------------------------
def run_build(slug: str) -> bool:
    # --- Validation: this student only ---
    check_result = subprocess.run(
        [sys.executable, str(BUILD_SCRIPT), "--only", slug, "--check", "--verbose"],
        cwd=DEMO_REPO,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )

    if check_result.returncode != 0:
        # Validation failed -> show ONLY this student's errors,
        # wrapped for direct copy-paste into a PR comment.
        errors = extract_student_errors(check_result.stdout, slug)
        err(f"{slug} has validation errors:")
        print()
        print("------- COPY BELOW INTO PR COMMENT -------")
        if errors:
            for line in errors:
                print(line)
        else:
            # Fallback: dump raw stdout if we couldn't parse it
            print(check_result.stdout.strip() or "(no error details captured)")
        print("------- COPY ABOVE INTO PR COMMENT -------")
        return False

    # --- Build: full project list, skip students with errors -----------
    # Uses --skip-errors so other broken students don't block this build.
    build_result = subprocess.run(
        [sys.executable, str(BUILD_SCRIPT), "--skip-errors", "--output", str(S26_JSON)],
        cwd=DEMO_REPO,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )

    if build_result.returncode != 0:
        err("Build failed unexpectedly:")
        print(build_result.stdout)
        if build_result.stderr:
            print(build_result.stderr, file=sys.stderr)
        return False

    return True


# --- Step 5: print git instructions -------------------------------------
def print_success(slug: str) -> None:
    ok(f"{slug} processed successfully.")
    print()
    print("Next steps:")
    print(f"  cd {DEMO_REPO}")
    print(f"  git add projects/{slug}/project.md")
    print(f'  git commit -m "add: {slug}"')
    print(f"  git push")
    print()
    print(f"  cd {SHOWCASE_REPO}")
    print(f"  git add data/projects/s26.json public/thumbnails/{slug}.*")
    print(f'  git commit -m "add: {slug}"')
    print(f"  git push")


# --- Main ---------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Process one student's submission (project.md auto-fix + build).",
    )
    parser.add_argument(
        "slug",
        help="Student slug, e.g. '02-aditya-nahush-patel'",
    )
    args = parser.parse_args()
    slug = args.slug.strip()

    # Sanity checks
    if not DEMO_REPO.exists():
        err(f"llm-course-26-app-demo not found at {DEMO_REPO}")
        sys.exit(1)
    if not SHOWCASE_REPO.exists():
        err(f"ams691-showcase not found at {SHOWCASE_REPO}")
        sys.exit(1)
    if not BUILD_SCRIPT.exists():
        err(f"build_s26_json.py not found at {BUILD_SCRIPT}")
        sys.exit(1)

    ext = detect_thumbnail_ext(slug)
    fix_project_md(slug, ext)
    if not run_build(slug):
        sys.exit(1)
    print_success(slug)


if __name__ == "__main__":
    main()
