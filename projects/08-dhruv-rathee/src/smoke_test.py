"""Quick smoke test for all backend modules."""
import sys
sys.path.insert(0, "backend")

from analyzers.blame_analyzer import BlameAnalyzer
from analyzers.history_tracer import HistoryTracer
from analyzers.context_gatherer import ContextGatherer
from analyzers.story_generator import StoryGenerator

print("All modules imported OK")

ba = BlameAnalyzer(".")
ht = HistoryTracer(".")

commits = ht.commits_for_file("README.md", max_commits=5)
print(f"commits_for_file(README.md) -> {len(commits)} commit(s)")
for c in commits:
    print(f"  {c.short_sha}  {c.timestamp[:10]}  {c.author}  {repr(c.short_message)}")

print("\nBlame test: first 5 lines of README.md")
lines = ba.blame_lines("README.md", 1, 5)
for l in lines:
    print(f"  L{l.line_number} [{l.commit_sha[:7]}] {l.author}: {l.content.strip()!r}")

print("\nSmoke test PASSED")
