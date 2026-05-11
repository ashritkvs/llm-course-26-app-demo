"""
core/cve_verifier.py - CVE Verification Against NVD Database
Prevents false positives by verifying CVEs exist before reporting
"""
import requests
from typing import Dict, Optional, List
import logging
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sys

# Configure logger to always output to console and file
logger = logging.getLogger('cve_verifier')
logger.setLevel(logging.INFO)

# Only add handlers if none exist (prevents duplicate logs)
if not logger.handlers:
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler (bot.log)
    try:
        file_handler = logging.FileHandler('bot.log', encoding='utf-8')
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(console_formatter)
        logger.addHandler(file_handler)
    except Exception:
        pass  # Silently fail if can't write to bot.log

class CVEVerifier:
    """Verify CVEs against NVD (National Vulnerability Database)"""
    
    NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    CACHE_FILE = "core/cve_cache.json"
    CACHE_EXPIRY_HOURS = 24
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize CVE verifier
        
        Args:
            api_key: NVD API key (optional, increases rate limit from 5 to 50 req/min)
        """
        self.api_key = api_key
        self.headers = {}
        if api_key:
            self.headers['apiKey'] = api_key
        
        self.cache = self._load_cache()
    
    def _load_cache(self) -> Dict:
        """Load CVE cache from file"""
        cache_path = Path(self.CACHE_FILE)
        if cache_path.exists():
            try:
                with open(cache_path) as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load CVE cache: {e}")
        return {}
    
    def _save_cache(self):
        """Save CVE cache to file"""
        try:
            cache_path = Path(self.CACHE_FILE)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_path, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save CVE cache: {e}")
    
    def _is_cache_valid(self, cve_id: str) -> bool:
        """Check if cached CVE data is still valid"""
        if cve_id not in self.cache:
            return False

        cached_time = datetime.fromisoformat(self.cache[cve_id]['cached_at'])
        expiry = cached_time + timedelta(hours=self.CACHE_EXPIRY_HOURS)
        return datetime.now(timezone.utc) < expiry
    
    def verify_cve(self, cve_id: str) -> Dict:
        """
        Verify if CVE exists in NVD database
        
        Args:
            cve_id: CVE identifier (e.g., "CVE-2021-44228")
        
        Returns:
            dict: {
                'verified': bool,
                'data': dict | None,
                'cvss': float,
                'severity': str,
                'description': str
            }
        """
        # Normalize CVE ID format
        cve_id = cve_id.upper().strip()
        
        # Check cache first
        if self._is_cache_valid(cve_id):
            logger.info(f"CVE {cve_id} found in cache")
            return self.cache[cve_id]['data']
        
        try:
            response = requests.get(
                f"{self.NVD_API_BASE}?cveId={cve_id}",
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('totalResults', 0) > 0:
                    vuln = data['vulnerabilities'][0]['cve']
                    result = self._parse_cve_data(vuln)
                    
                    # Cache the result
                    self.cache[cve_id] = {
                        'cached_at': datetime.now(timezone.utc).isoformat(),
                        'data': result
                    }
                    self._save_cache()
                    
                    logger.info(f"CVE {cve_id} verified: {result['severity']}")
                    return result
            
            # CVE not found
            result = {
                'verified': False,
                'data': None,
                'cvss': 0.0,
                'severity': 'UNKNOWN',
                'description': 'CVE not found in NVD database'
            }
            
            # Cache negative result for shorter time (1 hour)
            self.cache[cve_id] = {
                'cached_at': datetime.now(timezone.utc).isoformat(),
                'data': result
            }
            self._save_cache()
            
            logger.warning(f"CVE {cve_id} not found in NVD database")
            return result
        
        except requests.exceptions.RequestException as e:
            logger.error(f"NVD API request failed for {cve_id}: {e}")
            return {
                'verified': False,
                'data': None,
                'cvss': 0.0,
                'severity': 'UNKNOWN',
                'description': f'NVD API error: {str(e)}'
            }
        except Exception as e:
            logger.exception(f"Unexpected error verifying CVE {cve_id}: {e}")
            return {
                'verified': False,
                'data': None,
                'cvss': 0.0,
                'severity': 'UNKNOWN',
                'description': f'Verification error: {str(e)}'
            }
    
    def _parse_cve_data(self, vuln: Dict) -> Dict:
        """Parse CVE data from NVD response"""
        try:
            # Extract CVSS score
            cvss = 0.0
            severity = 'UNKNOWN'
            metrics = vuln.get('metrics', {})
            
            # Try CVSS v3.1 first, then v3.0, then v2.0
            for version in ['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV20']:
                if version in metrics:
                    cvss_data = metrics[version][0].get('cvssData', {})
                    cvss = cvss_data.get('baseScore', 0.0)
                    severity = cvss_data.get('baseSeverity', 'UNKNOWN')
                    break
            
            # Extract description
            description = ''
            descriptions = vuln.get('descriptions', [])
            for desc in descriptions:
                if desc.get('lang', '') == 'en':
                    description = desc.get('value', '')
                    break
            
            return {
                'verified': True,
                'data': vuln,
                'cvss': cvss,
                'severity': severity,
                'description': description[:500]  # Truncate long descriptions
            }
        except Exception as e:
            logger.error(f"Failed to parse CVE data: {e}")
            return {
                'verified': False,
                'data': None,
                'cvss': 0.0,
                'severity': 'UNKNOWN',
                'description': f'Parse error: {str(e)}'
            }
    
    def verify_multiple_cves(self, cve_ids: List[str]) -> Dict[str, Dict]:
        """
        Verify multiple CVEs at once
        
        Args:
            cve_ids: List of CVE identifiers
        
        Returns:
            dict: {cve_id: verification_result}
        """
        results = {}
        for cve_id in cve_ids:
            results[cve_id] = self.verify_cve(cve_id)
        return results
    
    def get_cvss_severity(self, cvss_score: float) -> str:
        """
        Get severity label from CVSS score
        
        Args:
            cvss_score: CVSS score (0.0-10.0)
        
        Returns:
            str: Severity label
        """
        if cvss_score >= 9.0:
            return 'CRITICAL'
        elif cvss_score >= 7.0:
            return 'HIGH'
        elif cvss_score >= 4.0:
            return 'MEDIUM'
        elif cvss_score >= 0.1:
            return 'LOW'
        else:
            return 'NONE'
    
    def clear_cache(self):
        """Clear CVE cache"""
        self.cache = {}
        cache_path = Path(self.CACHE_FILE)
        if cache_path.exists():
            cache_path.unlink()
        logger.info("CVE cache cleared")


# Global instance for easy import
_cve_verifier = None

def get_cve_verifier(api_key: Optional[str] = None) -> CVEVerifier:
    """Get or create CVE verifier instance"""
    global _cve_verifier
    if _cve_verifier is None:
        _cve_verifier = CVEVerifier(api_key)
    return _cve_verifier


# Convenience functions
def verify_cve(cve_id: str, api_key: Optional[str] = None) -> Dict:
    """Verify a single CVE"""
    verifier = get_cve_verifier(api_key)
    return verifier.verify_cve(cve_id)


def verify_multiple_cves(cve_ids: List[str], api_key: Optional[str] = None) -> Dict[str, Dict]:
    """Verify multiple CVEs"""
    verifier = get_cve_verifier(api_key)
    return verifier.verify_multiple_cves(cve_ids)