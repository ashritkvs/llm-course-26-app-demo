"""
agents/vuln_scanner.py — Part 2: Vulnerability Scanner
Accepts Part 1 recon dict (or JSON path) and runs 6 targeted vuln checks.
Run standalone:  python -m agents.vuln_scanner --recon reports/recon/recon_*.json
Or via main.py:  python main.py --target example.com --parts 1,2
"""
import re
import json
import time
import argparse
import urllib.parse
from dataclasses import asdict
from typing import Optional

import requests
from bs4 import BeautifulSoup
from rich.console import Console
from rich.panel import Panel
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool

from core.models import Vulnerability, VulnFindings, make_id
from core.utils import (
    console, safe_get, safe_post, save_json, save_markdown,
    cvss_to_severity, print_severity_table
)
from core.config import (
    GROQ_API_KEY, GROQ_MODEL_DEFAULT, GROQ_MODELS,
    GEMINI_API_KEY, GEMINI_MODEL_DEFAULT,
    NVD_API_KEY, VULN_DIR, LLM_PROVIDER, LLM_MODEL_DEFAULT,
    NVIDIA_API_KEY, NVIDIA_MODEL_DEFAULT
)
from core.cve_verifier import verify_cve

# ── Global state ─────────────────────────────────────────
vuln_findings: VulnFindings = None

def _truncate_recon(recon):
    """Truncate recon data for summary prompt to stay within token limits."""
    return {
        "target": recon.get("target"),
        "technologies": recon.get("technologies", [])[:10],
        "open_ports": [p.get("port") for p in recon.get("open_ports", [])[:10]],
        "subdomains": recon.get("subdomains", [])[:15],
        "emails": recon.get("emails", [])[:5]
    }


def _add_vuln(
    vuln_id: str,
    title: str,
    description: str,
    severity: str,
    cvss_score: float,
    category: str,
    target_url: str,
    evidence: str,
    remediation: str,
    tool_source: str,
    cve_id: Optional[str] = None,
    confidence: str = 'medium',
    verified: bool = False,
    cve_verified: bool = False,
    notes: str = ""
):
    """Add a vulnerability and log to console."""
    global vuln_findings

    vuln = Vulnerability(
        vuln_id=vuln_id,
        title=title,
        description=description,
        severity=severity,
        cvss_score=cvss_score,
        category=category,
        target_url=target_url,
        evidence=evidence,
        remediation=remediation,
        cve_ids=[cve_id] if cve_id else [],
        tool_source=tool_source,
        confidence=confidence,
        verified=verified,
        cve_verified=cve_verified,
        notes=notes
    )

    vuln_findings.add_vuln(vuln)

    from core.utils import severity_color
    color = severity_color(vuln.severity)
    console.print(
        f"  [{color}][{vuln.severity}][/{color}] {vuln.title[:65]} — {vuln.target_url[:60]}"
    )


# ══════════════════════════════════════════════════════════
#  TOOL 1 — HEADER AUDIT
# ══════════════════════════════════════════════════════════

REQUIRED_HEADERS = {
    "Strict-Transport-Security": (
        6.5,
        "Forces HTTPS; prevents downgrade attacks.",
        "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"
    ),
    "Content-Security-Policy": (
        6.1,
        "Mitigates XSS and data injection.",
        "Start with: Content-Security-Policy: default-src 'self'"
    ),
    "X-Frame-Options": (
        5.4,
        "Prevents clickjacking.",
        "Add: X-Frame-Options: DENY"
    ),
    "X-Content-Type-Options": (
        4.3,
        "Prevents MIME-type sniffing.",
        "Add: X-Content-Type-Options: nosniff"
    ),
    "Referrer-Policy": (
        3.7,
        "Controls referrer leakage.",
        "Add: Referrer-Policy: strict-origin-when-cross-origin"
    ),
    "Permissions-Policy": (
        3.5,
        "Restricts browser feature access.",
        "Add: Permissions-Policy: geolocation=(), microphone=(), camera=()"
    ),
}

LEAKY_HEADERS = {
    "Server": "Server version",
    "X-Powered-By": "Backend tech",
    "X-AspNet-Version": "ASP.NET version",
    "X-Generator": "CMS/framework"
}


@tool
def header_audit(url: str) -> str:
    """Audit HTTP security headers: missing protections and info leakage."""
    if not url.startswith("http"):
        url = f"https://{url}"
    
    console.print(f"\n[cyan]→ Header audit:[/cyan] {url}")
    
    try:
        r = requests.get(
            url,
            timeout=10,
            verify=False,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        headers = {k.lower(): v for k, v in r.headers.items()}
        result = {"missing": [], "leaky": [], "misconfigured": []}

        for h, (score, desc, fix) in REQUIRED_HEADERS.items():
            if h.lower() not in headers:
                result["missing"].append(h)
                _add_vuln(
                    vuln_id=make_id(f"missing_{h}", url),
                    title=f"Missing: {h}",
                    description=f"{h} not set. {desc}",
                    severity=cvss_to_severity(score),
                    cvss_score=score,
                    category="MissingHeader",
                    target_url=url,
                    evidence=f"No {h} in response",
                    remediation=fix,
                    tool_source="header_audit",
                    confidence='high',
                    verified=True
                )

        csp = headers.get("content-security-policy", "")
        if csp and any(x in csp for x in ["unsafe-inline", "unsafe-eval", "*"]):
            result["misconfigured"].append("CSP")
            _add_vuln(
                vuln_id=make_id("weak_csp", url),
                title="Weak Content-Security-Policy",
                description=f"CSP has unsafe directives: {csp[:100]}",
                severity="MEDIUM",
                cvss_score=5.4,
                category="MisconfiguredHeader",
                target_url=url,
                evidence=f"CSP: {csp[:100]}",
                remediation="Remove 'unsafe-inline', 'unsafe-eval', and wildcard sources.",
                tool_source="header_audit",
                confidence='high',
                verified=True
            )

        for h, desc in LEAKY_HEADERS.items():
            val = headers.get(h.lower(), "")
            if val:
                result["leaky"].append({h: val})
                _add_vuln(
                    vuln_id=make_id(f"leak_{h}", url),
                    title=f"Info disclosure: {h}",
                    description=f"{h}: {val} — {desc}",
                    severity="LOW",
                    cvss_score=3.5,
                    category="InfoDisclosure",
                    target_url=url,
                    evidence=f"{h}: {val}",
                    remediation=f"Remove the {h} header from server config.",
                    tool_source="header_audit",
                    confidence='high',
                    verified=True
                )

        return json.dumps(result, indent=2)
    
    except Exception as e:
        return f"Header audit error: {e}"


# ══════════════════════════════════════════════════════════
#  TOOL 2 — DIRECTORY ENUM
# ══════════════════════════════════════════════════════════

DIR_WORDLIST = [
    "admin", "administrator", "admin.php", "wp-admin", "wp-login.php", "cpanel",
    "phpmyadmin", "adminer.php", "login", "signin", "signup", "api", "api/v1", "api/v2",
    "graphql", "swagger", "swagger-ui.html", "api-docs", "openapi.json",
    "backup", "backups", "config", "settings", ".git", ".svn", ".env", ".htaccess",
    "web.config", "phpinfo.php", "test.php", "debug.php", "install.php", "setup.php",
    "console", "debug", "profiler", "health", "metrics", "actuator", "actuator/health",
    "actuator/env", "logs", "error.log", "access.log", "Dockerfile", "composer.json",
    "package.json", "robots.txt", "sitemap.xml", ".DS_Store",
]


@tool
def dir_enum(base_url: str, extra_paths: Optional[str] = None) -> str:
    """Enumerate hidden directories and sensitive files on the web server."""
    console.print(f"\n[cyan]→ Dir enum:[/cyan] {base_url}")

    if not base_url.startswith("http"):
        base_url = f"http://{base_url}"

    paths = list(DIR_WORDLIST) + (extra_paths.split(",") if extra_paths else [])
    found = []

    # First, get the baseline response (what a 404 looks like for this server)
    import urllib3
    urllib3.disable_warnings()

    sess = requests.Session()
    sess.verify = False
    sess.headers["User-Agent"] = "Mozilla/5.0"

    # Get baseline 404 response to detect catch-all redirects
    baseline_status = None
    baseline_size = 0
    try:
        baseline_url = f"{base_url.rstrip('/')}/this-path-should-not-exist-xyz123"
        baseline_r = sess.get(baseline_url, timeout=5, allow_redirects=False)
        baseline_status = baseline_r.status_code
        baseline_size = len(baseline_r.content)
        console.print(f"  [dim]Baseline 404: HTTP {baseline_status} ({baseline_size}B)[/dim]")
    except Exception:
        pass

    from concurrent.futures import ThreadPoolExecutor
    
    def probe_path(path):
        url = f"{base_url.rstrip('/')}/{path}"
        try:
            r = sess.get(url, timeout=4, allow_redirects=False)
            
            is_different_from_baseline = (
                r.status_code != baseline_status or
                len(r.content) != baseline_size
            )
            
            is_real_finding = (
                r.status_code in (200, 403, 401) or
                (r.status_code in (301, 302) and is_different_from_baseline and abs(len(r.content) - baseline_size) > 500)
            )
            
            if is_real_finding:
                size = len(r.content)
                return {"path": path, "status": r.status_code, "size": size, "url": url}
        except:
            pass
        return None

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(probe_path, paths))

    for res in results:
        if res:
            path = res["path"]
            status = res["status"]
            size = res["size"]
            url = res["url"]
            found.append(res)

            # Scoring logic: 
            # - 200 (Exposed): High/Critical
            # - 403/401 (Forbidden/Unauthorized): Low (existence disclosure only)
            # - 301/302 (Redirect): Low
            
            if status == 200:
                score = (
                    8.5 if any(k in path for k in [".env", ".git", "config", "backup"]) else
                    7.0 if any(k in path for k in ["admin", "console", "debug"]) else
                    5.5 if any(k in path for k in ["api", "swagger", "actuator"]) else
                    4.0
                )
            else:
                score = 3.0 # Existence disclosure is low risk

            _add_vuln(
                vuln_id=make_id(path, base_url),
                title=f"Path found: /{path} (HTTP {status})",
                description=f"/{path} returned {status} ({size}B).",
                severity=cvss_to_severity(score),
                cvss_score=score,
                category="PathExposure",
                target_url=url,
                evidence=f"GET {url} → {status} ({size}B)",
                remediation="Restrict or remove sensitive paths via server config.",
                tool_source="dir_enum",
                confidence='high' if status in (200, 403, 401) else 'medium',
                verified=True
            )
        time.sleep(0.08)

    return json.dumps({"found": found, "count": len(found)}, indent=2)


# ══════════════════════════════════════════════════════════
#  TOOL 3 — NIKTO / MANUAL WEB CHECKS
# ══════════════════════════════════════════════════════════

@tool
def nikto_scan(url: str) -> str:
    """Advanced Heuristic Security Engine. Checks for exposed sensitive files and misconfigurations."""
    console.print(f"\n[cyan]→ Heuristic Engine:[/cyan] {url}")
    
    if not url.startswith("http"):
        url = f"http://{url}"
    
    import concurrent.futures
    import requests
    import urllib3
    urllib3.disable_warnings()

    sensitive_paths = [
        ("/.git/config", 9.0, "Git config exposed", "repository details"),
        ("/.env", 9.0, ".env exposed", "environment variables"),
        ("/phpinfo.php", 6.5, "phpinfo exposed", "php settings"),
        ("/server-status", 5.0, "Apache status", "server status"),
        ("/console", 8.5, "Console exposed", "admin console"),
        ("/debug", 7.0, "Debug endpoint", "debug info"),
        ("/wp-config.php.bak", 8.5, "WP config backup", "database credentials"),
        ("/.htaccess", 5.0, "htaccess exposed", "server config"),
        ("/docker-compose.yml", 8.0, "Docker compose exposed", "container config"),
        ("/backup.zip", 7.5, "Backup archive exposed", "compressed backup"),
    ]
    
    found = []

    def check_path(item):
        path, score, title, evidence = item
        target_url = url.rstrip('/') + path
        try:
            r = requests.get(target_url, timeout=3, verify=False, allow_redirects=False)
            if r.status_code in (200, 301, 302, 403) and len(r.content) > 0:
                # Basic false positive check (e.g. custom 404 pages returning 200)
                if "404" not in r.text and "not found" not in r.text.lower():
                    return {"path": path, "status": r.status_code, "score": score, "title": title, "evidence_desc": evidence, "target": target_url}
        except:
            pass
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(check_path, item) for item in sensitive_paths]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                found.append({"path": res['path'], "status": res['status']})
                _add_vuln(
                    vuln_id=make_id(res['title'], res['target']),
                    title=res['title'],
                    description=f"{res['path']} returned {res['status']}",
                    severity=cvss_to_severity(res['score']),
                    cvss_score=res['score'],
                    category="Exposure",
                    target_url=res['target'],
                    evidence=f"HTTP {res['status']} indicating {res['evidence_desc']}",
                    remediation="Restrict access to sensitive paths.",
                    tool_source="heuristic_engine",
                    confidence='medium',
                    verified=True
                )
    
    return json.dumps({"manual_findings": found}, indent=2)


# ══════════════════════════════════════════════════════════
#  TOOL 4 — SQLI PROBE
# ══════════════════════════════════════════════════════════

SQLI_PAYLOADS = [
    "'", "''", "' OR '1'='1", "' OR 1=1--", "1' ORDER BY 1--",
    "'; SELECT SLEEP(3)--", "'; WAITFOR DELAY '0:0:3'--"
]

SQL_ERROR_RE = re.compile(
    r"(you have an error in your sql syntax|warning: mysql|unclosed quotation mark|"
    r"microsoft ole db|ora-\d{5}|postgresql.*error|pg_query|sqlite_master)",
    re.IGNORECASE
)


@tool
def sqli_probe(url: str, params: Optional[str] = None) -> str:
    """Test URL params for SQL injection (error-based and time-based)."""
    console.print(f"\n[cyan]→ SQLi probe:[/cyan] {url}")
    
    if not url.startswith("http"):
        url = f"http://{url}"
    
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    test_params = (
        {p: ["1"] for p in params.split(",")}
        if params else (query or {"id": ["1"]})
    )
    findings_list = []

    for param in test_params:
        for payload in SQLI_PAYLOADS[:6]:
            p = dict(test_params)
            p[param] = [payload]
            test_url = urllib.parse.urlunparse(
                parsed._replace(query=urllib.parse.urlencode(p, doseq=True))
            )
            start = time.time()
            r = safe_get(test_url)
            elapsed = time.time() - start
            
            if not r:
                continue
            
            body = r.text.lower()
            
            if SQL_ERROR_RE.search(body):
                title = f"SQLi (error-based) — {param}"
                findings_list.append({"param": param, "type": "error"})
                _add_vuln(
                    vuln_id=make_id(title, url),
                    title=title,
                    description=f"Param '{param}' reflects SQL error with: {payload}",
                    severity="CRITICAL",
                    cvss_score=9.8,
                    category="SQLi",
                    target_url=test_url,
                    evidence="SQL error in response",
                    remediation="Use parameterised queries / prepared statements.",
                    tool_source="sqli_probe",
                    confidence='medium',
                    verified=False,
                    notes="Requires manual verification"
                )
                break
            
            if "sleep" in payload.lower() and elapsed >= 2.5:
                title = f"SQLi (time-based) — {param}"
                findings_list.append({"param": param, "type": "time-based"})
                _add_vuln(
                    vuln_id=make_id(title, url),
                    title=title,
                    description=f"Param '{param}' caused {elapsed:.1f}s delay.",
                    severity="CRITICAL",
                    cvss_score=9.8,
                    category="SQLi",
                    target_url=test_url,
                    evidence=f"Delay: {elapsed:.2f}s",
                    remediation="Use parameterised queries.",
                    tool_source="sqli_probe",
                    confidence='medium',
                    verified=False,
                    notes="Requires manual verification"
                )
        
        time.sleep(0.15)

    return json.dumps({"sqli_findings": findings_list}, indent=2)


# ══════════════════════════════════════════════════════════
#  TOOL 5 — XSS PROBE
# ══════════════════════════════════════════════════════════

XSS_PAYLOADS = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '\'"><script>alert(1)</script>',
    '<svg onload=alert(1)>',
]


@tool
def xss_probe(url: str, params: Optional[str] = None) -> str:
    """Test URL params and HTML forms for reflected XSS."""
    console.print(f"\n[cyan]→ XSS probe:[/cyan] {url}")
    
    if not url.startswith("http"):
        url = f"http://{url}"
    
    findings_list = []
    r = safe_get(url)
    
    if not r:
        return json.dumps({"error": "unreachable"})
    
    soup = BeautifulSoup(r.text, "html.parser")
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    test_params = (
        {p: ["test"] for p in params.split(",")} if params else query
    )

    def reflected(body, payload):
        return payload in body and "&lt;script&gt;" not in body

    for param in test_params:
        for pl in XSS_PAYLOADS[:3]:
            p = dict(test_params)
            p[param] = [pl]
            test_url = urllib.parse.urlunparse(
                parsed._replace(query=urllib.parse.urlencode(p, doseq=True))
            )
            r2 = safe_get(test_url)
            
            if r2 and reflected(r2.text, pl):
                title = f"Reflected XSS — {param}"
                findings_list.append({"param": param, "payload": pl})
                _add_vuln(
                    vuln_id=make_id(title, url),
                    title=title,
                    description=f"Param '{param}' reflects payload unencoded.",
                    severity="HIGH",
                    cvss_score=7.4,
                    category="XSS",
                    target_url=test_url,
                    evidence=f"Payload `{pl}` reflected literally",
                    remediation="HTML-encode all output. Implement Content-Security-Policy.",
                    tool_source="xss_probe",
                    confidence='medium',
                    verified=False,
                    notes="Requires manual verification"
                )
            
            time.sleep(0.1)

    for form in soup.find_all("form")[:5]:
        action = urllib.parse.urljoin(url, form.get("action", url))
        method = form.get("method", "get").lower()
        fields = {
            i.get("name"): "test"
            for i in form.find_all("input")
            if i.get("name") and i.get("type", "text") not in ("submit", "hidden")
        }
        
        for field in fields:
            for pl in XSS_PAYLOADS[:2]:
                data = dict(fields)
                data[field] = pl
                r3 = (
                    safe_post(action, data)
                    if method == "post" else safe_get(action, data)
                )
                
                if r3 and reflected(r3.text, pl):
                    title = f"XSS (form) — {field}"
                    findings_list.append({"form_field": field, "action": action})
                    _add_vuln(
                        vuln_id=make_id(title, action),
                        title=title,
                        description=f"Form field '{field}' reflects payload unencoded.",
                        severity="HIGH",
                        cvss_score=7.4,
                        category="XSS",
                        target_url=action,
                        evidence=f"POST {action} payload reflected",
                        remediation="HTML-encode all output. Implement CSP.",
                        tool_source="xss_probe",
                        confidence='medium',
                        verified=False,
                        notes="Requires manual verification"
                    )
                time.sleep(0.1)

    return json.dumps(
        {"xss_findings": findings_list, "forms_checked": len(soup.find_all("form"))},
        indent=2
    )


# ══════════════════════════════════════════════════════════
#  TOOL 6 — CVE LOOKUP (WITH VERIFICATION)
# ══════════════════════════════════════════════════════════

@tool
def cve_lookup(software_and_version: str) -> str:
    """Look up known CVEs for a software/version string via NVD API with verification."""
    console.print(f"\n[cyan]→ CVE lookup:[/cyan] {software_and_version}")
    
    parts = software_and_version.strip().split()
    product = parts[0] if parts else software_and_version
    
    blocked_terms = ["cloudfront", "cloudflare", "aws", "azure", "gcp", "google cloud", "akamai", "fastly", "incapsula", "linux", "ubuntu", "debian", "windows"]
    if product.lower() in blocked_terms:
        return json.dumps({"error": f"Skipping CVE keyword search for generic term '{product}' to prevent false positive attribution."})

    hdrs = {"apiKey": NVD_API_KEY} if NVD_API_KEY else {}
    
    try:
        r = requests.get(
            "https://services.nvd.nist.gov/rest/json/cves/2.0",
            params={"keywordSearch": software_and_version, "resultsPerPage": 10},
            headers=hdrs,
            timeout=15
        )
        data = r.json()
        cve_list = []
        
        for item in data.get("vulnerabilities", [])[:10]:
            cve = item["cve"]
            cve_id = cve["id"]
            desc = next(
                (d["value"] for d in cve.get("descriptions", []) if d["lang"] == "en"),
                ""
            )
            
            cpe_match = False
            for conf in cve.get("configurations", []):
                for node in conf.get("nodes", []):
                    for match in node.get("cpeMatch", []):
                        if product.lower() in match.get("criteria", "").lower():
                            cpe_match = True
                            break
            
            if not cpe_match and cve.get("configurations"):
                continue
            
            # VERIFY CVE before reporting
            verification = verify_cve(cve_id)
            
            score = 0.0
            try:
                m = cve.get("metrics", {})
                score = (
                    m.get("cvssMetricV31", [{}])[0].get("cvssData", {}).get("baseScore", 0.0) or
                    m.get("cvssMetricV30", [{}])[0].get("cvssData", {}).get("baseScore", 0.0)
                )
            except Exception:
                pass
            
            cve_list.append({
                "id": cve_id,
                "score": score,
                "description": desc[:200],
                "verified": verification['verified']
            })
            
            if score >= 4.0:
                _add_vuln(
                    vuln_id=make_id(cve_id, product),
                    title=f"{cve_id} in {product}",
                    description=desc[:300],
                    severity=cvss_to_severity(score),
                    cvss_score=score,
                    category="CVE",
                    target_url=f"Component: {software_and_version}",
                    evidence=f"CVSS {score}",
                    remediation=f"Update {product} to latest patched version.",
                    cve_id=cve_id,
                    tool_source="nvd_api",
                    confidence='high' if verification['verified'] else 'low',
                    verified=verification['verified'],
                    cve_verified=verification['verified'],
                    notes="" if verification['verified'] else "CVE not verified in NVD database"
                )
        
        return json.dumps(
            {"cves": cve_list, "total": data.get("totalResults", 0)},
            indent=2
        )
    
    except Exception as e:
        return f"CVE lookup error: {e}"


# ══════════════════════════════════════════════════════════
#  AGENT
# ══════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are an Advanced Security Analysis Agent.
Your objective is to conduct a professional, thorough, and non-destructive vulnerability assessment.

⚠️  Authorized targets only. Maintain a formal and technical tone in all reporting.

METHODOLOGY:
1. header_audit — Analyze security headers for compliance and information leakage.
2. dir_enum — Discover hidden resource paths and potentially sensitive artifacts.
3. nikto_scan — Execute the Heuristic Security Engine to detect server-side misconfigurations.
4. sqli_probe — Evaluate endpoint parameters for SQL injection vulnerabilities.
5. xss_probe — Validate input sanitization against Cross-Site Scripting (XSS) vectors.
6. cve_lookup — Cross-reference detected software versions and identified CVEs with the NVD database.

SMART TARGETING:
- Prioritize verification of OSINT-identified CVEs.
- Tailor analysis based on detected tech stacks (e.g., WordPress, Nginx, Apache).
- Investigate non-standard ports (8080, 8443) with the same rigor as standard web ports.
"""


def build_agent(llm: ChatGroq) -> AgentExecutor:
    tools = [
        header_audit,
        dir_enum,
        nikto_scan,
        sqli_probe,
        xss_probe,
        cve_lookup
    ]
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])
    agent = create_tool_calling_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools, verbose=False, max_iterations=25)


def build_task(target: str, recon: dict) -> str:
    techs = list(set(recon.get("technologies", [])))
    ports = [str(p.get("port", "")) for p in recon.get("open_ports", [])]
    subdoms = recon.get("subdomains", [])[:10]
    dns_a = recon.get("dns_records", {}).get("A", [])
    
    shodan = recon.get("shodan_data", {})
    shodan_vulns = shodan.get("vulns", [])
    os_info = shodan.get("os", "unknown")
    
    return (
        f"Target: {target}\n"
        f"Base URL: https://{target}\n"
        f"IPs: {', '.join(dns_a) or 'unknown'}\n"
        f"Open ports: {', '.join(ports) or 'unknown'}\n"
        f"Technologies: {', '.join(techs) or 'unknown'}\n"
        f"Operating System: {os_info}\n"
        f"Subdomains: {', '.join(subdoms) or 'none'}\n"
        f"Identified CVEs (from OSINT): {', '.join(shodan_vulns) or 'none'}\n\n"
        "Run full vulnerability scan. Verify the identified CVEs using cve_lookup and run comprehensive heuristic checks."
    )


def run(recon: dict, model: str = GROQ_MODEL_DEFAULT, progress_callback=None) -> dict:
    """
    Entry point called by main.py.
    Accepts Part 1 recon dict, returns vuln findings dict.
    """
    global vuln_findings

    target = recon.get("target", "unknown")
    vuln_findings = VulnFindings(target=target)

    # Initialize LLM based on configured provider
    if LLM_PROVIDER == "gemini":
        primary_llm = ChatOpenAI(
            api_key=GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            model=GEMINI_MODEL_DEFAULT,
            temperature=0
        )
        fallback_llm = ChatGroq(
            model=model,
            api_key=GROQ_API_KEY,
            temperature=0,
            max_tokens=4096
        )
        llm = primary_llm.with_fallbacks([fallback_llm])
        console.print(f"[dim]Using LLM: Gemini ({GEMINI_MODEL_DEFAULT}) with Groq Fallback[/dim]")
            
    else:  # groq default
        primary_llm = ChatGroq(
            model=model,
            api_key=GROQ_API_KEY,
            temperature=0,
            max_tokens=4096
        )
        # Use OpenAI-compatible endpoint for Gemini to avoid package conflicts
        fallback_llm = ChatOpenAI(
            api_key=GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            model=GEMINI_MODEL_DEFAULT,
            temperature=0
        )
        llm = primary_llm.with_fallbacks([fallback_llm])
        console.print(f"[dim]Using LLM: Groq ({model}) with Gemini (OpenAI-mode) Fallback[/dim]")

    if progress_callback: progress_callback("Initiating multi-agent vulnerability assessment...")
    console.print(f"\n[bold]Part 2 — Vuln scan:[/bold] {target}")
    
    agent = build_agent(llm)
    
    if progress_callback: progress_callback(f"Analyzing {len(recon.get('technologies', []))} technologies for known CVEs...")
    agent.invoke({"input": build_task(target, recon)})

    if progress_callback: progress_callback("Synthesizing strategic security posture and executive summary...")

    # 3. Generate Strategic Executive Summary
    summary_prompt = f"""
    Based on these security findings for {target}:
    Recon summary: {json.dumps(_truncate_recon(recon))}
    Vulnerabilities: {json.dumps([asdict(v) for v in vuln_findings.vulnerabilities][:15])}
    
    Write a professional 2-3 sentence executive summary of the security posture. 
    Focus on strategic impact and overall risk. Keep it high-level and explainable to stakeholders.
    """
    try:
        summary_resp = llm.invoke(summary_prompt)
        strategic_summary = summary_resp.content
    except:
        strategic_summary = "The assessment revealed several security configurations and exposures that require attention to align with industry best practices."

    vuln_findings.scan_end = __import__("datetime").datetime.utcnow().isoformat()
    
    findings_dict = {
        "target": target,
        "scan_start": vuln_findings.scan_start,
        "scan_end": vuln_findings.scan_end,
        "strategic_summary": strategic_summary,
        "summary": vuln_findings.summary(),  # Keep this as counts dict for the report writer
        "vulnerabilities": [asdict(v) for v in vuln_findings.vulnerabilities],
    }

    json_path = save_json(findings_dict, VULN_DIR, "vulns", target)
    console.print(f"[green]✓[/green] Vuln JSON: {json_path}")

    # Print summary
    print_severity_table(
        f"Vuln summary — {target}",
        vuln_findings.summary(),
        [asdict(v) for v in vuln_findings.vulnerabilities],
    )
    
    return findings_dict


# ══════════════════════════════════════════════════════════
#  STANDALONE ENTRY
# ══════════════════════════════════════════════════════════

if __name__ == "__main__":
    from core.utils import load_json
    
    parser = argparse.ArgumentParser(description="Part 2 — Vuln scanner")
    parser.add_argument(
        "--recon",
        required=True,
        help="Path to Part 1 recon JSON"
    )
    parser.add_argument(
        "--model",
        default=GROQ_MODEL_DEFAULT,
        choices=list(GROQ_MODELS.keys())
    )
    args = parser.parse_args()
    run(load_json(args.recon), args.model)