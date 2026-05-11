import os
from pathlib import Path
from dotenv import load_dotenv
import sys

load_dotenv(override=True)

# ── NVIDIA NIM (Primary) ──────────────────────────────────
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_MODEL_DEFAULT = os.getenv("NVIDIA_MODEL", "qwen/qwen2.5-coder-32b-instruct")

# ── Groq (Fallback / Primary) ──────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL_DEFAULT = "openai/gpt-oss-120b"
GROQ_MODELS = {
    "qwen-2.5-32b": "Qwen 2.5 32B model on Groq",
    "llama-3.3-70b-versatile": "Best overall — strong reasoning + tool use",
    "llama3-groq-70b-8192-tool-use-preview": "Fine-tuned for tool calling",
    "llama-3.1-8b-instant": "Fastest — good for quick scans",
    "mixtral-8x7b-32768": "Large 32k context window",
}

# ── Gemini (Fallback when Groq rate limited) ─────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL_DEFAULT = "gemini-2.5-flash-preview-05-20"
GEMINI_MODELS = {
    "gemini-2.5-flash-preview-05-20": "Fast, efficient, large context",
    "gemini-2.0-flash-exp": "Experimental flash model",
}

# ── Primary Model Selection ──────────────────────────────
PRIMARY_LLM = os.getenv("PRIMARY_LLM", "nvidia").lower()

if PRIMARY_LLM == "nvidia":
    LLM_PROVIDER = "nvidia"
    LLM_MODEL_DEFAULT = NVIDIA_MODEL_DEFAULT
elif PRIMARY_LLM == "gemini":
    LLM_PROVIDER = "gemini"
    LLM_MODEL_DEFAULT = GEMINI_MODEL_DEFAULT
else:  # groq or default
    LLM_PROVIDER = "groq"
    LLM_MODEL_DEFAULT = GROQ_MODEL_DEFAULT

# ── Fallback Strategy ────────────────────────────────────
# Auto-fallback to Gemini when Groq rate limited
AUTO_FALLBACK = os.getenv("AUTO_FALLBACK", "true").lower() == "true"

# ── Optional API keys ─────────────────────────────────────
SHODAN_API_KEY = os.getenv("SHODAN_API_KEY", "")
NVD_API_KEY = os.getenv("NVD_API_KEY", "")

# ── Output paths ──────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
REPORTS_DIR = BASE_DIR / "reports"
RECON_DIR = REPORTS_DIR / "recon"
VULN_DIR = REPORTS_DIR / "vulns"
EXPLOIT_DIR = REPORTS_DIR / "exploits"
FINAL_DIR = REPORTS_DIR / "final"

# ── Scan defaults ─────────────────────────────────────────
HTTP_DELAY = float(os.getenv("HTTP_DELAY", "0.3"))
MAX_EXPLOIT_ATTEMPTS = int(os.getenv("MAX_EXPLOITS", "10"))

# ── SECURITY SETTINGS (NEW) ───────────────────────────────
# MCP Server Authentication
MCP_API_KEY = os.getenv("MCP_API_KEY", "")
if not MCP_API_KEY:
    # Generate and warn if not set
    import secrets
    MCP_API_KEY = f"pk_{secrets.token_urlsafe(32)}"
    print(f"⚠️  WARNING: MCP_API_KEY not set. Generated temporary key: {MCP_API_KEY}")
    print("⚠️  Set MCP_API_KEY in .env for production use")

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "100"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "3600"))

# Target Authorization
AUTHORIZED_TARGETS = os.getenv("AUTHORIZED_TARGETS", "").split(",")
if AUTHORIZED_TARGETS and AUTHORIZED_TARGETS[0] == "":
    AUTHORIZED_TARGETS = []

# Audit Logging
AUDIT_LOG_ENABLED = os.getenv("AUDIT_LOG_ENABLED", "true").lower() == "true"
AUDIT_LOG_FILE = os.getenv("AUDIT_LOG_FILE", "audit.log")

# Scan Restrictions
MAX_SCAN_DEPTH = int(os.getenv("MAX_SCAN_DEPTH", "3"))
MAX_PAGES_PER_SCAN = int(os.getenv("MAX_PAGES_PER_SCAN", "100"))
BLOCK_PRIVATE_IPS = os.getenv("BLOCK_PRIVATE_IPS", "true").lower() == "true"

def validate_config() -> tuple[bool, list[str]]:
    """Validate configuration before running"""
    errors = []
    warnings = []

    # Check required env vars - at least one LLM API key required
    if not GROQ_API_KEY and not GEMINI_API_KEY and not NVIDIA_API_KEY:
        errors.append("No API KEY set (NVIDIA, GROQ, or GEMINI)")
    elif not NVIDIA_API_KEY:
        warnings.append("NVIDIA_API_KEY not set - using Groq fallback")

    # Check Groq API key format
    if GROQ_API_KEY and not GROQ_API_KEY.startswith('gsk_'):
        errors.append("GROQ_API_KEY format invalid (should start with 'gsk_')")

    # Check Gemini API key format
    if GEMINI_API_KEY and not GEMINI_API_KEY.startswith('AI'):
        warnings.append("GEMINI_API_KEY format may be invalid (usually starts with 'AI')")

    # Check reports directory
    if not REPORTS_DIR.exists():
        try:
            REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            errors.append(f"Cannot create reports directory: {e}")

    # Check Nikto installation
    nikto_path = BASE_DIR / "nikto" / "program" / "nikto.pl"
    if not nikto_path.exists():
        warnings.append("Nikto not found - vulnerability scanning will be limited")

    # Print warnings
    if warnings:
        print("\n⚠️  Configuration Warnings:")
        for warning in warnings:
            print(f"  ⚠️  {warning}")
        print()

    return len(errors) == 0, errors

# Run at startup
if __name__ == "__main__":
    valid, errors = validate_config()
    if not valid:
        print("Configuration errors:")
        for error in errors:
            print(f"  ❌ {error}")
        sys.exit(1)
    print("✅ Configuration valid")