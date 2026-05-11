"""
core/utils.py — Shared utilities: HTTP helpers, CVSS, console, file I/O.
"""

import json
import time
import datetime
from pathlib import Path
from dataclasses import asdict
from typing import Optional

import requests
from rich.console import Console
from rich.table import Table

console = Console()

# ── CVSS ──────────────────────────────────────────────────

SEVERITY_COLORS = {
    "CRITICAL": "bold red",
    "HIGH":     "red",
    "MEDIUM":   "yellow",
    "LOW":      "green",
    "INFO":     "cyan",
}


def cvss_to_severity(score: float) -> str:
    if score >= 9.0: return "CRITICAL"
    if score >= 7.0: return "HIGH"
    if score >= 4.0: return "MEDIUM"
    if score >  0.0: return "LOW"
    return "INFO"


def severity_color(severity: str) -> str:
    return SEVERITY_COLORS.get(severity, "white")


# ── HTTP ──────────────────────────────────────────────────

_REQUEST_DELAY: float = 0.3
_SESSION = requests.Session()
_SESSION.verify = False
_SESSION.headers.update({"User-Agent": "Mozilla/5.0 (pentest-agent/1.0; authorized)"})

# Silence SSL warnings
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def set_delay(seconds: float):
    global _REQUEST_DELAY
    _REQUEST_DELAY = seconds


def safe_get(url: str, params: dict = None, timeout: int = 10) -> Optional[requests.Response]:
    time.sleep(_REQUEST_DELAY)
    try:
        return _SESSION.get(url, params=params, timeout=timeout, allow_redirects=True)
    except Exception:
        return None


def safe_post(url: str, data: dict = None, timeout: int = 10) -> Optional[requests.Response]:
    time.sleep(_REQUEST_DELAY)
    try:
        return _SESSION.post(url, data=data, timeout=timeout, allow_redirects=True)
    except Exception:
        return None


# ── FILE I/O ─────────────────────────────────────────────

def save_json(data: dict, output_dir: Path, prefix: str, target: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    ts         = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_name  = target.replace("/", "_").replace(":", "_").replace(".", "_")
    path       = output_dir / f"{prefix}_{safe_name}_{ts}.json"
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    return path


def save_markdown(text: str, output_dir: Path, prefix: str, target: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    ts         = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_name  = target.replace("/", "_").replace(":", "_").replace(".", "_")
    path       = output_dir / f"{prefix}_{safe_name}_{ts}.md"
    path.write_text(text, encoding="utf-8")
    return path


def load_json(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── CONSOLE HELPERS ──────────────────────────────────────

def print_severity_table(title: str, counts: dict, top_findings: list = None):
    table = Table(title=title, show_header=True)
    table.add_column("Severity", style="bold")
    table.add_column("Count",    style="bold")
    if top_findings:
        table.add_column("Top finding")

    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        count = counts.get(sev, 0)
        if not count:
            continue
        color = severity_color(sev)
        row = [f"[{color}]{sev}[/{color}]", str(count)]
        if top_findings:
            item = next((f for f in top_findings if f.get("severity") == sev), None)
            row.append(item["title"][:55] if item else "-")
        table.add_row(*row)
    console.print(table)
