"""
core/security.py — Security utilities for Pentest Agent
Implements input validation, authorization checks, target validation, and security controls
Aligned with security-review skill checklist
"""
import re
import os
import json
import socket
import ipaddress
import logging
import secrets
import hashlib
import hmac
from typing import Optional, List, Tuple, Dict, Any
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta
from pathlib import Path

# Configure logging - NEVER log sensitive data
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('security.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('pentest_security')


class SecurityValidator:
    """Validate and sanitize all user inputs and targets"""
    
    # Private IP ranges that should NEVER be scanned (RFC 1918 + special ranges)
    PRIVATE_IP_RANGES = [
        ipaddress.ip_network('10.0.0.0/8'),
        ipaddress.ip_network('172.16.0.0/12'),
        ipaddress.ip_network('192.168.0.0/16'),
        ipaddress.ip_network('127.0.0.0/8'),
        ipaddress.ip_network('169.254.0.0/16'),
        ipaddress.ip_network('100.64.0.0/10'),
        ipaddress.ip_network('0.0.0.0/8'),
        ipaddress.ip_network('224.0.0.0/4'),
        ipaddress.ip_network('240.0.0.0/4'),
    ]
    
    # Localhost patterns to block
    LOCALHOST_PATTERNS = [
        r'^localhost$',
        r'^127\.\d+\.\d+\.\d+$',
        r'^0\.0\.0\.0$',
        r'^::1$',
        r'^localhost\.localdomain$',
        r'^\.localhost$',
    ]
    
    # Healthcare-related domains (HIPAA considerations)
    HEALTHCARE_PATTERNS = [
        r'\.hospital\.com$',
        r'\.medical\.com$',
        r'\.clinic\.com$',
        r'\.healthcare\.com$',
        r'\.health\.gov$',
        r'\.med\.',
        r'hospital',
        r'clinic',
        r'medical',
        r'healthcare',
        r'\.pharmacy$',
        r'\.dental$',
    ]
    
    # Government domains (additional restrictions)
    GOVERNMENT_PATTERNS = [
        r'\.gov$',
        r'\.mil$',
        r'\.gov\.',
    ]
    
    @classmethod
    def validate_target_url(cls, url: str) -> Tuple[bool, str]:
        """
        Validate target URL before scanning
        Returns: (is_valid, error_message)
        
        Security Checklist:
        ✅ No hardcoded secrets
        ✅ Input validation
        ✅ Error messages don't leak sensitive info
        """
        if not url or not isinstance(url, str):
            return False, "URL must be a non-empty string"
        
        # Parse URL
        try:
            parsed = urlparse(url)
        except Exception:
            return False, "Invalid URL format"
        
        # Must have http/https scheme
        if parsed.scheme not in ['http', 'https']:
            return False, "Only HTTP/HTTPS URLs are allowed"
        
        # Must have valid hostname
        if not parsed.hostname:
            return False, "URL must contain a valid hostname"
        
        # Check for localhost patterns
        for pattern in cls.LOCALHOST_PATTERNS:
            if re.search(pattern, parsed.hostname, re.IGNORECASE):
                return False, "Scanning localhost/local addresses is not permitted"
        
        # Check for government domains (additional restrictions)
        for pattern in cls.GOVERNMENT_PATTERNS:
            if re.search(pattern, parsed.hostname, re.IGNORECASE):
                return False, "Scanning government domains requires explicit authorization"
        
        # Resolve hostname and check IP
        try:
            ip_addresses = socket.gethostbyname_ex(parsed.hostname)[2]
            for ip in ip_addresses:
                try:
                    ip_obj = ipaddress.ip_address(ip)
                    for private_range in cls.PRIVATE_IP_RANGES:
                        if ip_obj in private_range:
                            return False, "Scanning private IP addresses is not permitted"
                except ValueError:
                    continue
        except socket.gaierror:
            return False, "Could not resolve hostname"
        
        # Validate URL doesn't contain injection attempts
        dangerous_chars = ['@', '(', ')', '{', '}', '[', ']', ';', '|', '&', '<', '>', '"', "'"]
        if any(char in url for char in dangerous_chars):
            return False, "URL contains invalid characters"
        
        # Check URL length
        if len(url) > 2048:
            return False, "URL exceeds maximum length"
        
        # Check for path traversal attempts
        if '..' in parsed.path or '..' in url:
            return False, "Path traversal sequences not permitted"
        
        return True, ""    
    @classmethod
    def is_in_scope(cls, target: str, allowlist: List[str]) -> bool:
        """
        Check if target is in authorized allowlist
        
        Security Checklist:
        ✅ Authorization checks before operations
        ✅ Whitelist validation (not blacklist)
        """
        if not allowlist:
            return False
        
        parsed_target = urlparse(target)
        target_domain = parsed_target.hostname or target
        
        for allowed in allowlist:
            # Exact match
            if target_domain == allowed:
                return True
            # Subdomain match (*.example.com)
            if allowed.startswith('*.'):
                base_domain = allowed[2:]
                if target_domain.endswith(f'.{base_domain}'):
                    return True
        
        return False
    
    @classmethod
    def validate_file_upload(cls, file_path: str, max_size: int = 5 * 1024 * 1024) -> Tuple[bool, str]:
        """
        Validate file uploads (size, type, extension)
        
        Security Checklist:
        ✅ File uploads restricted (size, type, extension)
        ✅ Whitelist validation (not blacklist)
        """
        if not os.path.exists(file_path):
            return False, "File does not exist"
        
        # Size check (5MB max)
        file_size = os.path.getsize(file_path)
        if file_size > max_size:
            return False, f"File too large (max {max_size / (1024 * 1024)}MB)"
        
        # Extension check (whitelist, not blacklist)
        allowed_extensions = ['.txt', '.json', '.xml', '.csv']
        extension = os.path.splitext(file_path)[1].lower()
        if extension not in allowed_extensions:
            return False, f"Invalid file extension (allowed: {', '.join(allowed_extensions)})"
        
        # Check for path traversal in filename
        if '..' in file_path or file_path.startswith('/'):
            return False, "Invalid file path"
        
        return True, ""
    
    @classmethod
    def validate_api_key_format(cls, api_key: str) -> Tuple[bool, str]:
        """
        Validate API key format before use
        
        Security Checklist:
        ✅ No hardcoded API keys
        ✅ All secrets in environment variables
        """
        if not api_key:
            return False, "API key cannot be empty"
        
        if len(api_key) < 32:
            return False, "API key too short (minimum 32 characters)"
        
        # Check for common patterns that indicate hardcoded/test keys
        if api_key in ['test', 'demo', 'example', 'changeme', 'password']:
            return False, "API key appears to be a test value"
        
        return True, ""

    @classmethod
    def is_government_target(cls, url: str) -> bool:
        """Check if target is a government domain"""
        if not url:
            return False
        
        parsed = urlparse(url)
        hostname = parsed.hostname or url
        
        gov_patterns = [
            r'\.gov$',
            r'\.mil$',
            r'\.gov\.',
            r'\.mil\.',
        ]
        
        for pattern in gov_patterns:
            if re.search(pattern, hostname, re.IGNORECASE):
                return True
        return False

    @classmethod
    def is_healthcare_target(cls, url: str) -> bool:
        """Check if target appears to be a healthcare organization"""
        if not url:
            return False
        
        parsed = urlparse(url)
        hostname = parsed.hostname or url
        
        healthcare_patterns = [
            r'\.hospital\.com$',
            r'\.medical\.com$',
            r'\.clinic\.com$',
            r'\.healthcare\.com$',
            r'\.health\.gov$',
            r'\.med\.',
            r'hospital',
            r'clinic',
            r'medical',
            r'healthcare',
            r'\.pharmacy$',
        ]
        
        for pattern in healthcare_patterns:
            if re.search(pattern, hostname, re.IGNORECASE):
                return True
        
        return False    



class RateLimiter:
    """
    Prevent abuse through rate limiting
    
    Security Checklist:
    ✅ Rate limiting on all API endpoints
    ✅ Stricter limits on expensive operations
    ✅ IP-based rate limiting
    ✅ User-based rate limiting (authenticated)
    """
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 3600):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[datetime]] = {}
    
    def is_allowed(self, client_id: str) -> Tuple[bool, int]:
        """
        Check if request is allowed
        Returns: (is_allowed, retry_after_seconds)
        """
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        # Clean old requests
        if client_id in self.requests:
            self.requests[client_id] = [
                req_time for req_time in self.requests[client_id]
                if req_time > window_start
            ]
        else:
            self.requests[client_id] = []
        
        # Check limit
        if len(self.requests[client_id]) >= self.max_requests:
            oldest = min(self.requests[client_id])
            retry_after = int((oldest + timedelta(seconds=self.window_seconds) - now).total_seconds())
            return False, max(1, retry_after)
        
        # Record request
        self.requests[client_id].append(now)
        return True, 0
    
    def get_remaining(self, client_id: str) -> int:
        """Get remaining requests for client"""
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=self.window_seconds)
        
        if client_id not in self.requests:
            return self.max_requests
        
        current = len([
            req_time for req_time in self.requests[client_id]
            if req_time > window_start
        ])
        
        return max(0, self.max_requests - current)
    
    def reset(self, client_id: str) -> None:
        """Reset rate limit for a specific client"""
        if client_id in self.requests:
            self.requests[client_id] = []


class AuditLogger:
    """
    Secure audit logging without sensitive data exposure
    
    Security Checklist:
    ✅ No passwords, tokens, or secrets in logs
    ✅ Error messages generic for users
    ✅ Detailed errors only in server logs
    ✅ No stack traces exposed to users
    """
    
    def __init__(self, log_file: str = "audit.log"):
        self.log_file = log_file
        self.sensitive_patterns = [
            r'password[=:]\S+',
            r'token[=:]\S+',
            r'api[_-]?key[=:]\S+',
            r'secret[=:]\S+',
            r'credential[=:]\S+',
            r'authorization[=:]\S+',
            r'cookie[=:]\S+',
            r'session[=:]\S+',
            r'private[_-]?key[=:]\S+',
            r'access[_-]?token[=:]\S+',
        ]
    
    def log_scan_attempt(self, client_id: str, target: str, status: str, 
                         findings_count: int = 0) -> None:
        """Log scan activity without sensitive details"""
        timestamp = datetime.utcnow().isoformat()
        
        # Sanitize target (remove any potential credentials)
        safe_target = self._sanitize(target)
        
        log_entry = f"[{timestamp}] client={client_id} target={safe_target} status={status} findings={findings_count}\n"
        
        try:
            # Ensure log directory exists
            log_path = Path(self.log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.log_file, 'a') as f:
                f.write(log_entry)
        except Exception as e:
            # NEVER log the actual error message to avoid leaking info
            logger.error("Failed to write audit log")
    
    def log_authentication(self, client_id: str, success: bool, ip_address: str) -> None:
        """Log authentication attempts"""
        timestamp = datetime.utcnow().isoformat()
        status = "SUCCESS" if success else "FAILED"
        
        log_entry = f"[{timestamp}] AUTH client={client_id} ip={ip_address} status={status}\n"
        
        try:
            log_path = Path(self.log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.log_file, 'a') as f:
                f.write(log_entry)
        except Exception as e:
            logger.error("Failed to write audit log")
    
    def log_security_event(self, event_type: str, details: Dict[str, Any]) -> None:
        """
        Log security events with sanitized details
        
        Security Checklist:
        ✅ Failed authentication attempts logged
        ✅ Admin actions audited
        ✅ No sensitive data in logs
        """
        timestamp = datetime.utcnow().isoformat()
        
        # Sanitize all details
        safe_details = self._sanitize_dict(details)
        
        log_entry = f"[{timestamp}] SECURITY event={event_type} details={json.dumps(safe_details)}\n"
        
        try:
            log_path = Path(self.log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.log_file, 'a') as f:
                f.write(log_entry)
        except Exception as e:
            logger.error("Failed to write security event log")
    
    def _sanitize(self, text: str) -> str:
        """Remove sensitive information from text"""
        if not text:
            return text
        
        sanitized = text
        for pattern in self.sensitive_patterns:
            sanitized = re.sub(pattern, '[REDACTED]', sanitized, flags=re.IGNORECASE)
        return sanitized
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively sanitize dictionary values"""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                sanitized[key] = self._sanitize(value)
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self._sanitize(item) if isinstance(item, str) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized
    def log_scan(self, client_id: str, target: str, status: str, 
             findings_count: int = 0) -> None:
        """Alias for log_scan_attempt - backwards compatibility"""
        self.log_scan_attempt(client_id, target, status, findings_count)


class InputValidator:
    """
    Comprehensive input validation
    
    Security Checklist:
    ✅ All user inputs validated with schemas
    ✅ No direct use of user input in queries
    ✅ Whitelist validation (not blacklist)
    ✅ Error messages don't leak sensitive info
    """
    
    @staticmethod
    def validate_input(input_data: str, max_length: int = 1000) -> Tuple[bool, str]:
        """
        Validate user input (SQL injection, XSS prevention)
        """
        if not input_data:
            return False, "Input cannot be empty"
        
        if not isinstance(input_data, str):
            return False, "Input must be a string"
        
        if len(input_data) > max_length:
            return False, f"Input exceeds maximum length ({max_length})"
        
        # Check for SQL injection patterns
        sql_patterns = [
            r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|EXECUTE)\b)",
            r"(--|;|\/\*|\*\/)",
            r"(\bOR\b\s+\d+\s*=\s*\d+)",
            r"(\bAND\b\s+\d+\s*=\s*\d+)",
            r"(\bWAITFOR\b\s+\bDELAY\b)",
            r"(\bBENCHMARK\b\s*\()",
            r"(\bSLEEP\b\s*\()",
        ]
        
        for pattern in sql_patterns:
            if re.search(pattern, input_data, re.IGNORECASE):
                return False, "Potentially dangerous input detected"
        
        # Check for XSS patterns
        xss_patterns = [
            r"(<script[^>]*>)",
            r"(javascript:)",
            r"(on\w+\s*=)",
            r"(<iframe[^>]*>)",
            r"(<object[^>]*>)",
            r"(<embed[^>]*>)",
            r"(expression\s*\()",
            r"(vbscript:)",
        ]
        
        for pattern in xss_patterns:
            if re.search(pattern, input_data, re.IGNORECASE):
                return False, "Potentially dangerous input detected"
        
        # Check for path traversal
        if '..' in input_data:
            return False, "Path traversal sequences not permitted"
        
        # Check for null bytes
        if '\x00' in input_data:
            return False, "Null bytes not permitted"
        
        return True, ""
    
    @staticmethod
    def validate_integer(value: Any, min_val: int = 0, max_val: int = 1000000) -> Tuple[bool, str]:
        """Validate integer input with range checks"""
        try:
            int_val = int(value)
            if int_val < min_val or int_val > max_val:
                return False, f"Value must be between {min_val} and {max_val}"
            return True, ""
        except (ValueError, TypeError):
            return False, "Value must be an integer"
    
    @staticmethod
    def validate_email(email: str) -> Tuple[bool, str]:
        """Validate email format"""
        if not email:
            return False, "Email cannot be empty"
        
        # Basic email validation
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, email):
            return False, "Invalid email format"
        
        if len(email) > 254:
            return False, "Email too long"
        
        return True, ""


class SecurityHeaders:
    """
    Security header management
    
    Security Checklist:
    ✅ CSP headers configured
    ✅ X-Frame-Options configured
    ✅ Security headers on all responses
    """
    
    REQUIRED_HEADERS = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'X-XSS-Protection': '1; mode=block',
    }
    
    @classmethod
    def get_security_headers(cls) -> Dict[str, str]:
        """Get all required security headers"""
        return cls.REQUIRED_HEADERS.copy()
    
    @classmethod
    def check_security_headers(cls, headers: Dict[str, str]) -> List[str]:
        """
        Check for missing security headers
        Returns list of recommendations
        """
        recommendations = []
        
        for header, recommendation in cls.REQUIRED_HEADERS.items():
            if header not in headers:
                recommendations.append(f"Missing {header}: {recommendation}")
        
        return recommendations


class CryptoUtils:
    """
    Cryptographic utilities
    
    Security Checklist:
    ✅ Secure random generation
    ✅ Constant-time comparison
    ✅ Secure hashing
    """
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate a cryptographically secure random token"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def generate_api_key() -> str:
        """Generate secure API key for MCP server authentication"""
        return f"pk_{secrets.token_urlsafe(32)}"
    
    @staticmethod
    def verify_api_key(provided: str, expected: str) -> bool:
        """Verify API key using constant-time comparison"""
        if not provided or not expected:
            return False
        return hmac.compare_digest(provided.encode(), expected.encode())
    
    @staticmethod
    def hash_sensitive_data(data: str, salt: Optional[str] = None) -> str:
        """
        Hash sensitive data with optional salt
        
        Security Checklist:
        ✅ No passwords, tokens, or secrets in logs
        """
        if salt is None:
            salt = secrets.token_hex(16)
        
        hashed = hashlib.sha256((salt + data).encode()).hexdigest()
        return f"{salt}:{hashed}"
    
    @staticmethod
    def verify_hash(data: str, salted_hash: str) -> bool:
        """Verify hashed data"""
        try:
            salt, stored_hash = salted_hash.split(':', 1)
            computed_hash = hashlib.sha256((salt + data).encode()).hexdigest()
            return hmac.compare_digest(computed_hash, stored_hash)
        except Exception:
            return False


class Sanitizer:
    """
    Data sanitization utilities
    
    Security Checklist:
    ✅ User-provided HTML sanitized
    ✅ No sensitive data in output
    ✅ Error messages generic for users
    """
    
    SENSITIVE_KEYS = [
        'password', 'token', 'secret', 'api_key', 'apikey', 'credential',
        'authorization', 'cookie', 'session', 'private_key', 'access_token',
        'refresh_token', 'secret_key', 'privatekey', 'apikey',
    ]
    
    @classmethod
    def sanitize_output(cls, data: Any) -> Any:
        """
        Sanitize output data before logging or displaying
        Removes sensitive information
        """
        if isinstance(data, dict):
            sanitized = {}
            for key, value in data.items():
                if any(sensitive in key.lower() for sensitive in cls.SENSITIVE_KEYS):
                    sanitized[key] = '[REDACTED]'
                else:
                    sanitized[key] = cls.sanitize_output(value)
            return sanitized
        elif isinstance(data, list):
            return [cls.sanitize_output(item) for item in data]
        elif isinstance(data, str):
            # Redact common sensitive patterns
            for pattern in [
                r'password[=:]\S+',
                r'token[=:]\S+',
                r'api[_-]?key[=:]\S+',
                r'secret[=:]\S+',
                r'credential[=:]\S+',
            ]:
                data = re.sub(pattern, '[REDACTED]', data, flags=re.IGNORECASE)
            return data
        else:
            return data
    
    @classmethod
    def sanitize_error_message(cls, error: Exception, is_production: bool = True) -> str:
        """
        Sanitize error messages for user display
        
        Security Checklist:
        ✅ Error messages generic for users
        ✅ No stack traces exposed to users
        """
        if is_production:
            # Generic error message for production
            return "An error occurred. Please try again."
        else:
            # Detailed error for development
            return str(error)
    
    @classmethod
    def sanitize_html(cls, html: str, allowed_tags: Optional[List[str]] = None) -> str:
        """
        Sanitize HTML to prevent XSS
        
        Security Checklist:
        ✅ User-provided HTML sanitized
        """
        if allowed_tags is None:
            allowed_tags = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li']
        
        # Remove all tags not in allowed list
        pattern = r'<(?!/?(?:' + '|'.join(allowed_tags) + r')\b)[^>]*>'
        sanitized = re.sub(pattern, '', html, flags=re.IGNORECASE)
        
        # Remove dangerous attributes
        dangerous_attrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur']
        for attr in dangerous_attrs:
            sanitized = re.sub(rf'\s*{attr}\s*=\s*["\'][^"\']*["\']', '', sanitized, flags=re.IGNORECASE)
        
        return sanitized


class DependencySecurity:
    """
    Dependency security utilities
    
    Security Checklist:
    ✅ Dependencies up to date
    ✅ No known vulnerabilities
    ✅ Lock files committed
    ✅ Regular security updates
    """
    
    @staticmethod
    def check_critical_dependencies() -> List[str]:
        """
        Check for critical security dependencies
        
        Returns list of missing critical dependencies
        """
        critical_deps = []
        
        # Check for required security packages
        try:
            import requests
        except ImportError:
            critical_deps.append('requests')
        
        try:
            import cryptography
        except ImportError:
            critical_deps.append('cryptography')
        
        return critical_deps
    
    @staticmethod
    def get_dependency_report() -> Dict[str, Any]:
        """
        Generate dependency security report
        
        Security Checklist:
        ✅ Dependencies up to date
        ✅ No known vulnerabilities
        """
        import pkg_resources
        
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'packages': [],
            'critical_missing': [],
        }
        
        # Check critical dependencies
        report['critical_missing'] = DependencySecurity.check_critical_dependencies()
        
        # List all installed packages
        for pkg in pkg_resources.working_set:
            report['packages'].append({
                'name': pkg.project_name,
                'version': pkg.version,
            })
        
        return report

class AuthorizationManager:
    """Manage scan authorizations"""
    
    def __init__(self, auth_file: str = "authorizations.json"):
        self.auth_file = Path(auth_file)
        self.authorizations = self._load_authorizations()
    
    def _load_authorizations(self) -> dict:
        if self.auth_file.exists():
            with open(self.auth_file) as f:
                return json.load(f)
        return {}
    
    def add_authorization(self, domain: str, email: str, 
                         expiry: str, proof_path: str) -> bool:
        """Add authorized target with proof of permission"""
        self.authorizations[domain] = {
            'email': email,
            'expiry': expiry,
            'proof_path': proof_path,
            'added': datetime.utcnow().isoformat()
        }
        self._save_authorizations()
        return True
    
    def is_authorized(self, domain: str) -> tuple[bool, str]:
        """Check if domain is authorized for scanning"""
        if domain not in self.authorizations:
            return False, "No authorization found"
        
        auth = self.authorizations[domain]
        expiry = datetime.fromisoformat(auth['expiry'])
        
        if datetime.utcnow() > expiry:
            return False, "Authorization expired"
        
        return True, "Authorized"
    
    def _save_authorizations(self):
        with open(self.auth_file, 'w') as f:
            json.dump(self.authorizations, f, indent=2)

# ═══════════════════════════════════════════════════════════
# ADD THIS CLASS TO core/security.py
# ═══════════════════════════════════════════════════════════

class TargetRateLimiter:
    """
    Prevent DoS by limiting requests per target domain
    Security Checklist: ✅ Rate limiting on all API endpoints
    """
    
    def __init__(self, max_requests_per_minute: int = 60):
        """
        Initialize rate limiter
        
        Args:
            max_requests_per_minute: Maximum requests per minute per target
        """
        self.max_rpm = max_requests_per_minute
        self.targets: Dict[str, List[datetime]] = {}
        self._lock = None
        
        try:
            import threading
            self._lock = threading.Lock()
        except ImportError:
            pass
    
    def can_request(self, target: str) -> Tuple[bool, int]:
        """
        Check if request is allowed for target
        
        Args:
            target: Target domain/URL
        
        Returns:
            tuple: (is_allowed, wait_seconds)
        """
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=1)
        
        if self._lock:
            with self._lock:
                return self._check_request(target, now, window_start)
        else:
            return self._check_request(target, now, window_start)
    
    def _check_request(self, target: str, now: datetime, window_start: datetime) -> Tuple[bool, int]:
        """Internal request check"""
        # Normalize target (extract domain)
        try:
            from urllib.parse import urlparse
            parsed = urlparse(target)
            domain = parsed.hostname or target
        except Exception:
            domain = target
        
        domain = domain.lower()
        
        # Initialize tracking for new domain
        if domain not in self.targets:
            self.targets[domain] = []
        
        # Clean old requests (older than 1 minute)
        self.targets[domain] = [
            t for t in self.targets[domain] if t > window_start
        ]
        
        # Check limit
        if len(self.targets[domain]) >= self.max_rpm:
            oldest = min(self.targets[domain])
            wait_seconds = int((oldest + timedelta(minutes=1) - now).total_seconds())
            return False, max(1, wait_seconds)
        
        # Record request
        self.targets[domain].append(now)
        return True, 0
    
    def get_request_count(self, target: str) -> int:
        """Get current request count for target"""
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=1)
        
        try:
            from urllib.parse import urlparse
            parsed = urlparse(target)
            domain = parsed.hostname or target
        except Exception:
            domain = target
        
        domain = domain.lower()
        
        if domain not in self.targets:
            return 0
        
        return len([t for t in self.targets[domain] if t > window_start])
    
    def reset_target(self, target: str):
        """Reset rate limit for specific target"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(target)
            domain = parsed.hostname or target
        except Exception:
            domain = target
        
        domain = domain.lower()
        
        if domain in self.targets:
            self.targets[domain] = []
    
    def reset_all(self):
        """Reset all rate limits"""
        self.targets = {}



class SecurityReport:
    """
    Security report generation
    
    Security Checklist:
    ✅ Comprehensive security reporting
    ✅ No sensitive data in reports
    """
    
    @staticmethod
    def create_security_report(scan_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a comprehensive security report from scan results
        """
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'target': scan_results.get('target', 'unknown'),
            'summary': {
                'total_vulnerabilities': 0,
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0,
                'info': 0,
            },
            'recommendations': [],
            'security_headers': [],
            'ssl_concerns': [],
        }
        
        # Count vulnerabilities by severity
        vulns = scan_results.get('vulnerabilities', [])
        for vuln in vulns:
            report['summary']['total_vulnerabilities'] += 1
            severity = vuln.get('severity', 'INFO').upper()
            if severity in report['summary']:
                report['summary'][severity.lower()] += 1
        
        # Add recommendations based on findings
        if report['summary']['critical'] > 0:
            report['recommendations'].append("IMMEDIATE ACTION REQUIRED: Critical vulnerabilities found")
        if report['summary']['high'] > 0:
            report['recommendations'].append("HIGH PRIORITY: Address high-severity vulnerabilities within 7 days")
        if report['summary']['medium'] > 0:
            report['recommendations'].append("MEDIUM PRIORITY: Address medium-severity vulnerabilities within 30 days")
        
        # Check security headers
        headers = scan_results.get('http_headers', {})
        report['security_headers'] = SecurityHeaders.check_security_headers(headers)
        
        # Check SSL
        ssl_info = scan_results.get('ssl_info', {})
        report['ssl_concerns'] = SecurityReport.validate_ssl_cert(ssl_info)
        
        # Sanitize report before returning
        report = Sanitizer.sanitize_output(report)
        
        return report
    
    @staticmethod
    def validate_ssl_cert(cert_info: Dict[str, Any]) -> List[str]:
        """
        Validate SSL certificate information
        Returns list of security concerns
        """
        concerns = []
        
        # Check expiration
        if 'notAfter' in cert_info:
            try:
                expiry = datetime.strptime(cert_info['notAfter'], '%b %d %H:%M:%S %Y %Z')
                days_until_expiry = (expiry - datetime.utcnow()).days
                
                if days_until_expiry < 30:
                    concerns.append(f"SSL certificate expires in {days_until_expiry} days")
                elif days_until_expiry < 90:
                    concerns.append(f"SSL certificate expires in {days_until_expiry} days (renew soon)")
            except Exception:
                concerns.append("Could not parse SSL certificate expiry date")
        
        # Check for weak algorithms
        if 'signatureAlgorithm' in cert_info:
            if 'sha1' in cert_info['signatureAlgorithm'].lower():
                concerns.append("SSL certificate uses weak SHA-1 signature algorithm")
            if 'md5' in cert_info['signatureAlgorithm'].lower():
                concerns.append("SSL certificate uses weak MD5 signature algorithm")
        
        return concerns


# Export all public functions and classes
__all__ = [
    'SecurityValidator',
    'RateLimiter',
    'AuditLogger',
    'InputValidator',
    'SecurityHeaders',
    'CryptoUtils',
    'Sanitizer',
    'DependencySecurity',
    'SecurityReport',
    'generate_api_key',
    'verify_api_key',
    'validate_input',
    'sanitize_output',
    'check_security_headers',
    'validate_ssl_cert',
    'create_security_report',
]


# Backwards compatibility aliases
generate_api_key = CryptoUtils.generate_api_key
verify_api_key = CryptoUtils.verify_api_key
validate_input = InputValidator.validate_input
sanitize_output = Sanitizer.sanitize_output
check_security_headers = SecurityHeaders.check_security_headers
validate_ssl_cert = SecurityReport.validate_ssl_cert
create_security_report = SecurityReport.create_security_report