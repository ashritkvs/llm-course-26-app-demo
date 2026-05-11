"""
agents/recon_agent.py — Part 1: Recon & OSINT Agent
Imports shared models/utils from core/.
Run standalone:  python -m agents.recon_agent --target example.com
Or via main.py:  python main.py --target example.com --parts 1
"""

import os
import json
import socket
import argparse
import datetime
from dataclasses import asdict
from pathlib import Path
from typing import Optional

import whois
import dns.resolver
import requests
from rich.console import Console
from rich.panel import Panel
from langchain_groq import ChatGroq
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool

from core.models import ReconFindings, make_id
from core.utils  import console, safe_get, save_json, save_markdown, print_severity_table
from core.config import (
    GROQ_API_KEY, GROQ_MODEL_DEFAULT, GROQ_MODELS,
    SHODAN_API_KEY, RECON_DIR,
)

# ── Global state (set in main / run()) ───────────────────
findings: ReconFindings = None

# ══════════════════════════════════════════════════════════
#  TOOL 1 — WHOIS
# ══════════════════════════════════════════════════════════

@tool
def whois_lookup(domain: str) -> str:
    """WHOIS lookup: registrar, dates, nameservers, emails, org."""
    console.print(f"  [cyan]→ WHOIS:[/cyan] {domain}")
    try:
        w = whois.whois(domain)
        result = {
            "registrar":       str(w.registrar or "N/A"),
            "creation_date":   str(w.creation_date or "N/A"),
            "expiration_date": str(w.expiration_date or "N/A"),
            "nameservers":     list(w.name_servers or []),
            "emails":          list(w.emails or []),
            "org":             str(w.org or "N/A"),
            "country":         str(w.country or "N/A"),
        }
        findings.whois_info = result
        findings.emails.extend(result["emails"])
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"WHOIS error: {e}"


# ══════════════════════════════════════════════════════════
#  TOOL 2 — DNS ENUM
# ══════════════════════════════════════════════════════════

@tool
def dns_enum(domain: str) -> str:
    """Enumerate DNS records: A, AAAA, MX, NS, TXT, CNAME, SOA."""
    console.print(f"  [cyan]→ DNS enum:[/cyan] {domain}")
    record_types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]
    results = {}
    resolver = dns.resolver.Resolver()
    resolver.timeout = 5
    for rtype in record_types:
        try:
            results[rtype] = [str(r) for r in resolver.resolve(domain, rtype)]
        except Exception:
            results[rtype] = []
    findings.dns_records = results
    if results.get("A"):
        console.print(f"    [green]IPs:[/green] {', '.join(results['A'])}")
    return json.dumps(results, indent=2)


# ══════════════════════════════════════════════════════════
#  TOOL 3 — SUBDOMAIN ENUM
# ══════════════════════════════════════════════════════════

COMMON_SUBDOMAINS = [
    "www","mail","ftp","admin","api","dev","staging","test","vpn","remote",
    "portal","login","app","dashboard","docs","blog","shop","store","support",
    "help","status","beta","cdn","static","assets","media","img","images",
    "smtp","pop","imap","mx","ns1","ns2","dns","db","database","mysql",
    "postgres","redis","elastic","jenkins","gitlab","jira","confluence",
    "grafana","kibana","prometheus","vault","k8s","kubernetes",
]

@tool
def subdomain_enum(domain: str) -> str:
    """Enumerate subdomains via DNS bruteforce using a common wordlist."""
    console.print(f"  [cyan]→ Subdomain enum:[/cyan] {domain}")
    found = []
    
    import concurrent.futures
    import dns.resolver

    resolver = dns.resolver.Resolver()
    resolver.timeout = 2
    resolver.lifetime = 2

    def resolve_sub(sub):
        fqdn = f"{sub}.{domain}"
        try:
            ips = [str(r) for r in resolver.resolve(fqdn, "A")]
            return {"subdomain": fqdn, "ips": ips}
        except:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = list(executor.map(resolve_sub, COMMON_SUBDOMAINS))

    for res in results:
        if res:
            found.append(res)
            console.print(f"    [green]✓[/green] {res['subdomain']} → {', '.join(res['ips'])}")

    findings.subdomains = [s["subdomain"] for s in found]
    return json.dumps({"found": found, "count": len(found)}, indent=2)


# ══════════════════════════════════════════════════════════
#  TOOL 4 — PORT SCANNER
# ══════════════════════════════════════════════════════════

DEFAULT_PORTS = "21,22,23,25,53,80,110,143,443,445,3306,3389,5432,6379,8080,8443,27017"

@tool
def port_scan(target: str, ports: str = DEFAULT_PORTS) -> str:
    """Pure Python TCP port scan with basic banner grabbing. No local system tools required."""
    console.print(f"  [cyan]→ Port scan:[/cyan] {target}  ports={ports}")
    results = []
    
    # Common service mappings for ports
    port_map = {
        21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "dns", 
        80: "http", 110: "pop3", 143: "imap", 443: "https", 445: "smb", 
        3306: "mysql", 3389: "rdp", 5432: "postgresql", 6379: "redis", 
        8080: "http-alt", 8443: "https-alt", 27017: "mongodb"
    }

    import socket
    import concurrent.futures

    def scan_port(port):
        try:
            with socket.create_connection((target, port), timeout=1.5) as s:
                banner = ""
                # Try to grab banner for non-HTTP ports
                if port not in (80, 443, 8080, 8443):
                    try:
                        s.settimeout(0.5)
                        banner = s.recv(1024).decode('utf-8', errors='ignore').strip()
                    except:
                        pass
                return {"port": port, "state": "open", "service": port_map.get(port, "unknown"), "banner": banner[:50]}
        except Exception:
            return None

    port_list = [int(p) for p in ports.split(",")]
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(scan_port, p): p for p in port_list}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                results.append(res)
                console.print(f"    [yellow]OPEN[/yellow] {res['port']} ({res['service']}) {res['banner']}")

    findings.open_ports = results
    return json.dumps({"open_ports": results}, indent=2)


# ══════════════════════════════════════════════════════════
#  TOOL 5 — HTTP FINGERPRINT
# ══════════════════════════════════════════════════════════

TECH_SIGNATURES = {
    "WordPress":  ["wp-content","wp-includes"],
    "Drupal":     ["drupal","sites/all"],
    "Joomla":     ["joomla","option=com_"],
    "Django":     ["csrfmiddlewaretoken"],
    "Laravel":    ["XSRF-TOKEN"],
    "React":      ["__REACT","react"],
    "Angular":    ["ng-version","angular"],
    "Next.js":    ["__NEXT_DATA__"],
    "Nginx":      ["nginx"],
    "Apache":     ["apache","mod_"],
    "IIS":        ["microsoft-iis","x-aspnet"],
    "Cloudflare": ["cf-ray","cloudflare"],
    "AWS":        ["x-amz","amazon"],
}

@tool
def http_fingerprint(url: str) -> str:
    """Fetch HTTP headers, detect tech stack, audit security headers."""
    if not url.startswith("http"):
        url = f"https://{url}"
    console.print(f"  [cyan]→ HTTP fingerprint:[/cyan] {url}")
    try:
        import urllib3
        urllib3.disable_warnings()
        r = requests.get(url, timeout=10, verify=False,
                         headers={"User-Agent": "Mozilla/5.0"},
                         allow_redirects=True)
        headers   = dict(r.headers)
        body_low  = r.text.lower()
        techs     = [t for t, sigs in TECH_SIGNATURES.items()
                     if any(s in body_low or any(s in str(v).lower() for v in headers.values())
                            for s in sigs)]
        sec_headers = {
            h: headers.get(h, "MISSING ⚠️")
            for h in ["Strict-Transport-Security","Content-Security-Policy",
                      "X-Frame-Options","X-Content-Type-Options","Referrer-Policy"]
        }
        result = {
            "status_code":   r.status_code,
            "server":        headers.get("Server","N/A"),
            "technologies":  list(set(techs)),
            "security_headers": sec_headers,
            "interesting":   {k: v for k, v in headers.items()
                              if k.lower() in ["x-powered-by","x-generator","via","set-cookie"]},
        }
        findings.technologies.extend(result["technologies"])
        findings.http_headers = headers
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"HTTP error: {e}"


# ══════════════════════════════════════════════════════════
#  TOOL 6 — SSL CERT
# ══════════════════════════════════════════════════════════

@tool
def ssl_cert_info(domain: str) -> str:
    """Retrieve TLS cert: issuer, expiry, Subject Alt Names (reveals hidden subdomains)."""
    console.print(f"  [cyan]→ SSL cert:[/cyan] {domain}")
    try:
        import ssl
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.create_connection((domain, 443), timeout=10),
                             server_hostname=domain) as s:
            cert = s.getpeercert()
        sans = [v for t, v in cert.get("subjectAltName", []) if t == "DNS"]
        result = {
            "subject":   dict(x[0] for x in cert.get("subject", [])),
            "issuer":    dict(x[0] for x in cert.get("issuer", [])),
            "notBefore": cert.get("notBefore"),
            "notAfter":  cert.get("notAfter"),
            "sans":      sans,
        }
        findings.ssl_info = result
        for san in sans:
            if not san.startswith("*.") and san not in findings.subdomains:
                findings.subdomains.append(san)
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"SSL error: {e}"


# ══════════════════════════════════════════════════════════
#  TOOL 7 — SHODAN
# ══════════════════════════════════════════════════════════

@tool
def shodan_lookup(ip_or_domain: str) -> str:
    """Passive Shodan intel: open ports, CVEs, ISP, geo, hostnames."""
    import time
    if not SHODAN_API_KEY:
        return "SHODAN_API_KEY not set — skipping."
    console.print(f"  [cyan]→ Shodan:[/cyan] {ip_or_domain}")
    try:
        target = socket.gethostbyname(ip_or_domain)
    except Exception:
        target = ip_or_domain
    try:
        # Add delay before Shodan API call to reduce token rate
        time.sleep(1)
        r = requests.get(f"https://api.shodan.io/shodan/host/{target}",
                         params={"key": SHODAN_API_KEY}, timeout=10)
        data = r.json()
        if "error" in data:
            return f"Shodan: {data['error']}"
        result = {
            "ip": data.get("ip_str"), "org": data.get("org"),
            "isp": data.get("isp"), "country": data.get("country_name"),
            "ports": data.get("ports",[]), "vulns": list(data.get("vulns",{}).keys()),
            "hostnames": data.get("hostnames",[]),
        }
        findings.shodan_data = result
        if result["vulns"]:
            console.print(f"    [red]CVEs:[/red] {', '.join(result['vulns'])}")
        return json.dumps(result, indent=2)
    except Exception as e:
        return f"Shodan error: {e}"


# ══════════════════════════════════════════════════════════
#  AGENT
# ══════════════════════════════════════════════════════════

SYSTEM_PROMPT = """You are an autonomous recon agent. Perform thorough reconnaissance.

⚠️  Only test systems you have explicit written permission to test.

ORDER:
1. whois_lookup
2. dns_enum
3. ssl_cert_info
4. subdomain_enum
5. http_fingerprint
6. port_scan  (resolve domain to IP first)
7. shodan_lookup (call ONLY ONCE on the primary domain - do not call on multiple IPs)

IMPORTANT: Call shodan_lookup EXACTLY ONCE on the primary target. Do NOT call it on individual IPs from DNS results.
"""

def build_agent(llm: ChatGroq) -> AgentExecutor:
    import time
    tools  = [whois_lookup, dns_enum, subdomain_enum, port_scan,
              http_fingerprint, ssl_cert_info, shodan_lookup]
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])
    agent = create_tool_calling_agent(llm, tools, prompt)
    
    # Add delay between tool executions to avoid rate limits
    class DelayBetweenTools:
        def on_tool_end(self, output, **kwargs):
            time.sleep(2)
    
    return AgentExecutor(agent=agent, tools=tools, verbose=False, max_iterations=20)


def run(target: str, model: str = GROQ_MODEL_DEFAULT, progress_callback=None) -> dict:
    import time
    global findings
    findings = ReconFindings(target=target)

    console.print(f"\n[bold]Part 1 — Recon:[/bold] {target}")
    
    from concurrent.futures import ThreadPoolExecutor
    
    if progress_callback: progress_callback("Engaging multi-threaded reconnaissance engine...")
    
    def run_tool(name, func, target):
        try:
            if progress_callback: progress_callback(f"Gathering {name} intelligence...")
            func.invoke(target)
        except Exception as e:
            console.print(f"[dim]Tool {name} failed: {e}[/dim]")

    # Tools that can run in parallel
    parallel_tools = [
        ("WHOIS", whois_lookup),
        ("DNS", dns_enum),
        ("SSL", ssl_cert_info),
        ("Subdomains", subdomain_enum),
        ("HTTP Stack", http_fingerprint),
        ("Shodan", shodan_lookup)
    ]

    with ThreadPoolExecutor(max_workers=len(parallel_tools)) as executor:
        for name, tool in parallel_tools:
            executor.submit(run_tool, name, tool, target)

    # Port scan is usually heavier, run it after or in parallel if resources allow
    if progress_callback: progress_callback("Scanning active service ports and banners...")
    try: port_scan.invoke(target)
    except: pass

    findings_dict = asdict(findings)

    # Persist outputs
    json_path = save_json(findings_dict, RECON_DIR, "recon", target)
    console.print(f"[green]✓[/green] Recon JSON: {json_path}")

    return findings_dict


# ══════════════════════════════════════════════════════════
#  STANDALONE ENTRY
# ══════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Part 1 — Recon agent")
    parser.add_argument("--target", required=True)
    parser.add_argument("--model",  default=GROQ_MODEL_DEFAULT, choices=list(GROQ_MODELS.keys()))
    args = parser.parse_args()
    run(args.target, args.model)
