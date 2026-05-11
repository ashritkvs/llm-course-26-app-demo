"""Debug script for function detection."""
import sys
sys.path.insert(0, "/Users/dhruvrathee/Desktop/CodeStory/backend")

from pathlib import Path
from analyzers.blame_analyzer import BlameAnalyzer

ba = BlameAnalyzer("/tmp/requests")
lines = Path("/tmp/requests/src/requests/adapters.py").read_text().splitlines()

for idx, line in enumerate(lines, start=1):
    for pat in ba._FUNC_PATTERNS:
        m = pat.match(line)
        if m and m.group(1) == "send":
            end = ba._find_end_line(lines, idx - 1)
            print(f"Match at line {idx}, end={end}, span={end - idx + 1}")
            print(f"  Content: {repr(line)}")
            # show a few lines around the end
            print(f"  Line {end}: {repr(lines[end - 1]) if end <= len(lines) else 'EOF'}")
            break
