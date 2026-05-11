"""
main.py — Unified pipeline runner for all parts.
Chains Part 1 → Part 2 → Part 3 → Part 4 automatically.
"""
import os
import sys
import json
import argparse
import datetime
import time
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from core.config import (
    GROQ_MODEL_DEFAULT, GROQ_MODELS, REPORTS_DIR,
    MCP_API_KEY, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS,
    AUTHORIZED_TARGETS, AUDIT_LOG_ENABLED, AUDIT_LOG_FILE
)
from core.utils import load_json, save_json, save_markdown, console
from core.security import SecurityValidator, RateLimiter, AuditLogger

import sys
import io

if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')



# Initialize security components
security_validator = SecurityValidator()
rate_limiter = RateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS)
audit_logger = AuditLogger(AUDIT_LOG_FILE) if AUDIT_LOG_ENABLED else None

# ── Lazy imports so each part is only loaded when needed ──
def run_part1(target: str, model: str) -> dict:
    from agents.recon_agent import run
    return run(target, model)

def run_part2(recon: dict, model: str) -> dict:
    from agents.vuln_scanner import run
    return run(recon, model)

def run_part3(vulns: dict, model: str, severity: list, dry_run: bool) -> dict:
    from agents.exploit_engine import run
    return run(vulns, model, severity, dry_run)

def run_part4(recon: dict, vulns: dict, exploits: dict, model: str) -> dict:
    from agents.report_writer import run
    return run(recon, vulns, exploits, model)

def banner():
    """Display startup banner"""
    console.print(Panel.fit(
        "[bold]Pentest Agent[/bold] - autonomous security testing pipeline\n"
        "[dim]Part 1: Recon -> Part 2: Vuln scan -> Part 3: Exploit -> Part 4: Report[/dim]",
        border_style="cyan"
    ))
from core.authorization import is_authorized
def validate_authorization(target: str, api_key: str = None) -> tuple[bool, str]:
    """
    Validate scan authorization before proceeding
    Simplified for bug bounty / security research use
    
    Security Protections (Cannot be bypassed):
    - No government domains (.gov, .mil)
    - No healthcare domains (HIPAA)
    - No private IP addresses
    - No localhost/internal addresses
    
    Returns: (is_authorized, error_message)
    """
    # Validate API key if provided (for MCP server mode)
    if api_key and MCP_API_KEY:
        from core.security import verify_api_key
        if not verify_api_key(api_key, MCP_API_KEY):
            return False, "Invalid API key"
    
    # Validate target URL (prevents SSRF, private IPs, etc.)
    is_valid, error = security_validator.validate_target_url(target)
    if not is_valid:
        return False, f"Invalid target: {error}"
    
    # SECURITY: Block government domains (legal protection)
    from core.security import SecurityValidator
    if SecurityValidator.is_government_target(target):
        return False, "Government domains (.gov, .mil) are not permitted"
    
    # SECURITY: Block healthcare domains (HIPAA protection)
    if SecurityValidator.is_healthcare_target(target):
        return False, "Healthcare domains are not permitted (HIPAA restrictions)"
    
    # ✅ Allow all other public domains for bug bounty / security research
    return True, "Authorized for security research"

def main():
    parser = argparse.ArgumentParser(
        description="Pentest Agent — run all or specific pipeline parts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # Targeting
    parser.add_argument("--target", help="Domain or IP to test")
    parser.add_argument("--recon", help="Existing Part 1 JSON (skip Part 1)")
    parser.add_argument("--vulns", help="Existing Part 2 JSON (skip Parts 1+2)")
    parser.add_argument("--exploits", help="Existing Part 3 JSON (skip Parts 1+2+3)")
    # Pipeline control
    parser.add_argument("--parts", default="1,2,3,4",
        help="Comma-separated parts to run (default: 1,2,3,4)")
    # Options
    parser.add_argument("--model", default=GROQ_MODEL_DEFAULT,
        choices=list(GROQ_MODELS.keys()),
        help=f"Groq model (default: {GROQ_MODEL_DEFAULT})")
    parser.add_argument("--severity", default="CRITICAL,HIGH",
        help="Severity filter for Part 3 (default: CRITICAL,HIGH)")
    parser.add_argument("--dry-run", action="store_true",
        help="Part 3: plan exploits but send no HTTP requests")
    parser.add_argument("--delay", type=float, default=0.3,
        help="Seconds between HTTP requests (default: 0.3)")
    parser.add_argument("--output", default=str(REPORTS_DIR),
        help=f"Base output directory (default: {REPORTS_DIR})")
    # SECURITY: API key for MCP server mode
    parser.add_argument("--api-key", default=None,
        help="API key for authentication (required for MCP server mode)")
    # SECURITY: Client ID for rate limiting
    parser.add_argument("--client-id", default="default",
        help="Client identifier for rate limiting")
    
    args = parser.parse_args()
    parts = [int(p.strip()) for p in args.parts.split(",")]
    sev = [s.strip().upper() for s in args.severity.split(",")]

    # Auto-append https:// if no protocol specified
    target = args.target.strip() if args.target else ""
    if target and not target.startswith('http://') and not target.startswith('https://'):
        console.print(f"[yellow]⚠️  No protocol detected, auto-appending https://[/yellow]")
        target = f'https://{target}'
        console.print(f"[green]✓ Target: {target}[/green]")
        args.target = target

    # SECURITY: Rate limiting check
    is_allowed, retry_after = rate_limiter.is_allowed(args.client_id)
    if not is_allowed:
        console.print("[bold red]⚠️  Rate limit exceeded. Try again in {} seconds[/bold red]".format(retry_after))
        if audit_logger:
            audit_logger.log_scan(args.client_id, args.target or "unknown", "RATE_LIMITED", 0)
        sys.exit(1)

    # SECURITY: Validate authorization before any scanning
    if args.target:
        is_authorized, error = validate_authorization(args.target, args.api_key)
        if not is_authorized:
            console.print(f"[bold red]⚠️  Authorization failed: {error}[/bold red]")
            console.print("[dim]This tool should only be used on systems you own or have explicit written permission to test.[/dim]")
            if audit_logger:
                audit_logger.log_scan(args.client_id, args.target, "UNAUTHORIZED", 0)
            sys.exit(1)
    
    # Validate other arguments
    if 1 in parts and not args.target and not args.recon and not args.vulns:
        parser.error("--target required when running Part 1")
    if 2 in parts and not args.target and not args.recon and not args.vulns:
        parser.error("--target or --recon required for Part 2")
    if 3 in parts and not args.target and not args.recon and not args.vulns:
        parser.error("--target, --recon, or --vulns required for Part 3")
    
    # Set HTTP delay globally
    from core.utils import set_delay
    set_delay(args.delay)
    
    banner()
    console.print(f"[dim]Parts: {parts}  |  Model: {args.model}  |  Severity: {sev}  |  Dry-run: {args.dry_run}[/dim]\n")
    
    start_time = datetime.datetime.now(datetime.timezone.utc)
    recon_data = {}
    vuln_data = {}
    exploit_data = {}
    report_data = {}
    
    try:
        # ── Part 1 ───────────────────────────────────────────
        if 1 in parts:
            console.print(Rule("[bold cyan]Part 1 — Recon & OSINT[/bold cyan]"))
            target = args.target
            recon_data = run_part1(target, args.model)
        elif args.recon:
            console.print(f"[dim]Loading recon from {args.recon}[/dim]")
            recon_data = load_json(args.recon)
        
        # ── Part 2 ───────────────────────────────────────────
        if 2 in parts:
            console.print(Rule("[bold yellow]Part 2 — Vulnerability Scanner[/bold yellow]"))
            if not recon_data and args.target:
                recon_data = {"target": args.target, "technologies": [],
                    "open_ports": [], "dns_records": {}, "subdomains": []}
            # Add delay to avoid Groq rate limiting
            console.print("[dim]⏳ Waiting 3s to avoid rate limiting...[/dim]")
            time.sleep(3)
            vuln_data = run_part2(recon_data, args.model)
        elif args.vulns:
            console.print(f"[dim]Loading vulns from {args.vulns}[/dim]")
            vuln_data = load_json(args.vulns)

        # ── Part 3 ───────────────────────────────────────────
        if 3 in parts:
            console.print(Rule("[bold red]Part 3 — Exploitation Engine[/bold red]"))
            if not vuln_data:
                console.print("[red]No vulnerability data for Part 3. Run Part 2 first.[/red]")
                sys.exit(1)
            # Add delay to avoid Groq rate limiting
            console.print("[dim]⏳ Waiting 3s to avoid rate limiting...[/dim]")
            time.sleep(3)
            exploit_data = run_part3(vuln_data, args.model, sev, args.dry_run)
        elif args.exploits:
            console.print(f"[dim]Loading exploits from {args.exploits}[/dim]")
            exploit_data = load_json(args.exploits)

        # ── Part 4 ───────────────────────────────────────────
        if 4 in parts:
            console.print(Rule("[bold green]Part 4 — Report Writer[/bold green]"))
            if not vuln_data:
                console.print("[red]No vulnerability data for Part 4. Run Part 2 first.[/red]")
                sys.exit(1)
            # Provide empty dicts for any missing upstream data
            if not recon_data:
                recon_data = {"target": vuln_data.get("target","unknown"),
                    "subdomains":[], "open_ports":[], "technologies":[],
                    "dns_records":{}, "emails":[], "shodan_data":{}, "ssl_info":{}}
            if not exploit_data:
                exploit_data = {"target": vuln_data.get("target","unknown"),
                    "results":[], "confirmed_count":0, "summary":{},
                    "session_start": "", "session_end": ""}
            # Add delay to avoid Groq rate limiting (report has 7 LLM calls)
            console.print("[dim]⏳ Waiting 5s to avoid rate limiting (report generation makes 7 LLM calls)...[/dim]")
            time.sleep(5)
            report_data = run_part4(recon_data, vuln_data, exploit_data, args.model)
        
        # ── Final summary ─────────────────────────────────────
        elapsed = (datetime.datetime.now(datetime.timezone.utc) - start_time).seconds
        console.print(Rule("[bold green]Pipeline complete[/bold green]"))
        console.print(f"[dim]Total time: {elapsed}s[/dim]\n")
        
        if recon_data:
            subs = len(recon_data.get("subdomains", []))
            ports = len(recon_data.get("open_ports", []))
            console.print(f"  [cyan]Recon:[/cyan]    {subs} subdomains, {ports} open ports")
        if vuln_data:
            summary = vuln_data.get("summary", {})
            crit = summary.get("CRITICAL", 0)
            high = summary.get("HIGH", 0)
            total = len(vuln_data.get("vulnerabilities", []))
            console.print(f"  [yellow]Vulns:[/yellow]    {crit} critical, {high} high  (total {total})")
        if exploit_data:
            confirmed = exploit_data.get("confirmed_count", 0)
            console.print(f"  [red]Exploits:[/red] {confirmed} confirmed")
        if report_data:
            risk = report_data.get("overall_risk","N/A")
            risk_color = {"CRITICAL":"bold red","HIGH":"red","MEDIUM":"yellow","LOW":"green"}.get(risk,"white")
            console.print(f"  [green]Report:[/green]   Overall risk [{risk_color}]{risk}[/{risk_color}]")
            console.print(f"\n[bold]Deliverables:[/bold]")
            console.print(f"    Markdown → {report_data.get('md_path')}")
            console.print(f"    HTML     → {report_data.get('html_path')}")
            console.print(f"    JSON     → {report_data.get('json_path')}")
        else:
            console.print(f"\n[green]All reports saved to:[/green] {args.output}")
        
        # SECURITY: Log successful scan
        if audit_logger:
            findings_count = len(vuln_data.get("vulnerabilities", []))
            audit_logger.log_scan_attempt(args.client_id, args.target or "unknown", "SUCCESS", findings_count)
    
    except KeyboardInterrupt:
        console.print("\n[yellow]Scan interrupted by user[/yellow]")
        if audit_logger:
            audit_logger.log_scan(args.client_id, args.target or "unknown", "INTERRUPTED", 0)
        sys.exit(1)
    except Exception as e:
        # Use ASCII-safe error message for Windows
        error_msg = str(e).encode('ascii', 'replace').decode('ascii')
        console.print(f"[bold red]X Error: {error_msg}[/bold red]")
        if audit_logger:
            audit_logger.log_scan(args.client_id, args.target or "unknown", "ERROR", 0)
        sys.exit(1)

if __name__ == "__main__":
    main()