"""
End-to-end generation test script.

Requires a live backend with a workspace that has indexed documents and a professor profile.

Usage:
    python -m backend.scripts.test_generation_e2e --workspace-id <uuid> --token <jwt>

Defaults:
    --base-url http://localhost:8000
    --question-count 5
    --format-type mcq
"""
from __future__ import annotations

import argparse
import sys
import time

import httpx


def main() -> None:
    parser = argparse.ArgumentParser(description="E2E generation test")
    parser.add_argument("--workspace-id", required=True, help="Workspace UUID")
    parser.add_argument("--token", required=True, help="Supabase JWT token")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL")
    parser.add_argument("--question-count", type=int, default=5, help="Number of questions")
    parser.add_argument("--format-type", default="mcq", help="mcq | frq | mixed")
    args = parser.parse_args()

    headers = {"Authorization": f"Bearer {args.token}"}
    base = args.base_url.rstrip("/")
    workspace_id = args.workspace_id

    print(f"Posting generation request to workspace {workspace_id}...")
    body = {
        "request_type": "practice_set",
        "generation_config": {
            "question_count": args.question_count,
            "format_type": args.format_type,
        },
    }

    resp = httpx.post(
        f"{base}/api/workspaces/{workspace_id}/generation-requests",
        json=body,
        headers=headers,
        timeout=10,
    )
    resp.raise_for_status()
    request_data = resp.json()
    request_id = request_data["id"]
    print(f"Generation request created: {request_id} (status: {request_data['status']})")

    print("Polling for completion...")
    for attempt in range(60):
        time.sleep(2)
        poll_resp = httpx.get(
            f"{base}/api/workspaces/{workspace_id}/generation-requests/{request_id}",
            headers=headers,
            timeout=10,
        )
        poll_resp.raise_for_status()
        status = poll_resp.json()["status"]
        print(f"  Attempt {attempt + 1}: status={status}")

        if status == "completed":
            break
        if status == "failed":
            print("Generation failed.")
            sys.exit(1)
    else:
        print("Timed out waiting for generation to complete.")
        sys.exit(1)

    print("\nFetching generated exams...")
    exams_resp = httpx.get(
        f"{base}/api/workspaces/{workspace_id}/exams",
        headers=headers,
        timeout=10,
    )
    exams_resp.raise_for_status()
    exams = exams_resp.json()
    print(f"Found {len(exams)} exam(s)")

    if not exams:
        print("No exams found.")
        sys.exit(1)

    exam_id = exams[0]["id"]
    print(f"\nFetching exam detail: {exam_id}")
    detail_resp = httpx.get(
        f"{base}/api/workspaces/{workspace_id}/exams/{exam_id}",
        headers=headers,
        timeout=10,
    )
    detail_resp.raise_for_status()
    detail = detail_resp.json()

    print(f"\nExam: {detail['title']}")
    print(f"Mode: {detail['exam_mode']} | Format: {detail['format_type']}")
    print(f"Questions: {len(detail['questions'])}\n")

    for q in detail["questions"]:
        print(f"  Q{q['question_order']}: {q['question_text'][:80]}")
        if q.get("options"):
            for i, opt in enumerate(q["options"]):
                letter = chr(65 + i)
                print(f"    {letter}. {opt}")
        print()

    print("E2E test passed.")


if __name__ == "__main__":
    main()
