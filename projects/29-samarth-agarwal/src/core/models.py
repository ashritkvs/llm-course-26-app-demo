"""
core/models.py — Shared dataclasses for all pipeline stages.
Every agent imports from here so data flows cleanly across parts.
"""

import datetime
import hashlib
from dataclasses import dataclass, field, asdict
from typing import Optional
from dataclasses import dataclass, field
from typing import Literal

# ══════════════════════════════════════════════════════════
#  PART 1 — RECON MODELS
# ══════════════════════════════════════════════════════════

@dataclass
class ReconFindings:
    """Output of Part 1 — feeds directly into Part 2."""
    target:       str
    timestamp:    str   = field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    whois_info:   dict  = field(default_factory=dict)
    dns_records:  dict  = field(default_factory=dict)
    subdomains:   list  = field(default_factory=list)
    open_ports:   list  = field(default_factory=list)
    technologies: list  = field(default_factory=list)
    emails:       list  = field(default_factory=list)
    shodan_data:  dict  = field(default_factory=dict)
    http_headers: dict  = field(default_factory=dict)
    ssl_info:     dict  = field(default_factory=dict)
    notes:        list  = field(default_factory=list)


# ══════════════════════════════════════════════════════════
#  PART 2 — VULNERABILITY MODELS
# ══════════════════════════════════════════════════════════

@dataclass
class Vulnerability:
    """Single vulnerability finding from Part 2."""
    vuln_id:     str
    title:       str
    description: str
    severity:    str        # CRITICAL / HIGH / MEDIUM / LOW / INFO / NONE
    cvss_score:  float
    category:    str        # SQLi / XSS / MissingHeader / CVE / PathExposure / etc.
    target_url:  str
    evidence:    str
    remediation: str
    cve_ids:     list = field(default_factory=list)
    tool_source: str = ""
    verified: bool = False
    cve_verified: bool = False
    confidence: Literal['low', 'medium', 'high'] = 'medium'
    notes: str = ""
    manual_review_required: bool = True

@dataclass
class VulnFindings:
    """Output of Part 2 — feeds directly into Part 3."""
    target:          str
    scan_start:      str  = field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    scan_end:        str  = ""
    vulnerabilities: list = field(default_factory=list)   # list[Vulnerability]
    skipped_checks:  list = field(default_factory=list)
    notes:           list = field(default_factory=list)

    def add_vuln(self, vuln: Vulnerability):
        existing_ids = {v.vuln_id for v in self.vulnerabilities}
        if vuln.vuln_id not in existing_ids:
            self.vulnerabilities.append(vuln)

    def summary(self) -> dict:
        counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
        for v in self.vulnerabilities:
            counts[v.severity] = counts.get(v.severity, 0) + 1
        return counts


# ══════════════════════════════════════════════════════════
#  PART 3 — EXPLOIT MODELS
# ══════════════════════════════════════════════════════════

@dataclass
class ExploitResult:
    """Single confirmed/failed exploit attempt from Part 3."""
    exploit_id:       str
    vuln_title:       str
    vuln_category:    str
    target_url:       str
    status:           str     # CONFIRMED / FAILED / SKIPPED / ERROR
    technique:        str
    request_sent:     str
    response_snippet: str
    impact:           str
    cvss_score:       float
    severity:         str
    evidence_type:    str     # data_leak / error_message / delay / reflection / auth_success
    timestamp:        str     = field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    notes:            str     = ""


@dataclass
class ExploitSession:
    """Output of Part 3 — feeds directly into Part 4."""
    target:        str
    session_start: str  = field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    session_end:   str  = ""
    results:       list = field(default_factory=list)   # list[ExploitResult]
    dry_run:       bool = False

    def add_result(self, r: ExploitResult):
        self.results.append(r)

    def confirmed(self) -> list:
        return [r for r in self.results if r.status == "CONFIRMED"]

    def summary(self) -> dict:
        counts: dict = {}
        for r in self.results:
            counts[r.status] = counts.get(r.status, 0) + 1
        return counts


# ══════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════

def make_id(label: str, url: str) -> str:
    """Stable 10-char dedup key."""
    return hashlib.md5(f"{label}:{url}".encode()).hexdigest()[:10]


def to_dict(obj) -> dict:
    """Recursively convert dataclass to plain dict."""
    return asdict(obj)
