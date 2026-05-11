"""
core/authorization.py - Scan Authorization Management
Track which targets you're authorized to scan for legal compliance
"""
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Tuple, Optional, List, Dict
import logging

logger = logging.getLogger(__name__)

class AuthorizationManager:
    """Manage scan authorizations for legal compliance"""
    
    def __init__(self, auth_file: str = "authorizations.json"):
        """
        Initialize authorization manager
        
        Args:
            auth_file: Path to authorization storage file
        """
        self.auth_file = Path(auth_file)
        self.authorizations = self._load_authorizations()
    
    def _load_authorizations(self) -> Dict:
        """Load authorizations from file"""
        if self.auth_file.exists():
            try:
                with open(self.auth_file) as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load authorizations: {e}")
        return {}
    
    def _save_authorizations(self):
        """Save authorizations to file"""
        try:
            self.auth_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.auth_file, 'w') as f:
                json.dump(self.authorizations, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save authorizations: {e}")
    
    def add_authorization(
        self,
        domain: str,
        email: str,
        days_valid: int = 30,
        proof_path: str = "",
        notes: str = ""
    ) -> bool:
        """
        Add authorized target with proof of permission
        
        Args:
            domain: Domain to authorize (e.g., "example.com" or "*.example.com")
            email: Contact email for authorization
            days_valid: Number of days authorization is valid
            proof_path: Path to written authorization document
            notes: Additional notes
        
        Returns:
            bool: True if successful
        """
        domain = domain.lower().strip()
        
        self.authorizations[domain] = {
            'email': email,
            'added': datetime.utcnow().isoformat(),
            'expiry': (datetime.utcnow() + timedelta(days=days_valid)).isoformat(),
            'days_valid': days_valid,
            'proof_path': proof_path,
            'notes': notes,
            'status': 'active'
        }
        
        self._save_authorizations()
        logger.info(f"Added authorization for {domain} (expires in {days_valid} days)")
        return True
    
    def is_authorized(self, domain: str) -> Tuple[bool, str]:
        """
        Check if domain is authorized for scanning
        
        Args:
            domain: Domain to check
        
        Returns:
            tuple: (is_authorized, reason)
        """
        domain = domain.lower().strip()
        
        # Check exact match
        if domain in self.authorizations:
            return self._check_authorization_status(domain)
        
        # Check wildcard matches (*.example.com)
        for auth_domain, auth_data in self.authorizations.items():
            if auth_domain.startswith('*.'):
                base_domain = auth_domain[2:]
                if domain.endswith(f'.{base_domain}') or domain == base_domain:
                    return self._check_authorization_status(auth_domain)
        
        return False, "No authorization found for this domain"
    
    def _check_authorization_status(self, domain: str) -> Tuple[bool, str]:
        """Check authorization status for a specific domain"""
        auth = self.authorizations[domain]
        
        # Check if explicitly revoked
        if auth.get('status') == 'revoked':
            return False, "Authorization has been revoked"
        
        # Check expiry
        expiry = datetime.fromisoformat(auth['expiry'])
        if datetime.utcnow() > expiry:
            return False, f"Authorization expired on {expiry.strftime('%Y-%m-%d')}"
        
        days_remaining = (expiry - datetime.utcnow()).days
        return True, f"Authorized (expires in {days_remaining} days)"
    
    def revoke_authorization(self, domain: str) -> bool:
        """
        Revoke authorization for a domain
        
        Args:
            domain: Domain to revoke
        
        Returns:
            bool: True if successful
        """
        domain = domain.lower().strip()
        
        if domain in self.authorizations:
            self.authorizations[domain]['status'] = 'revoked'
            self.authorizations[domain]['revoked_at'] = datetime.utcnow().isoformat()
            self._save_authorizations()
            logger.info(f"Revoked authorization for {domain}")
            return True
        
        logger.warning(f"Cannot revoke: {domain} not found")
        return False
    
    def extend_authorization(self, domain: str, days: int = 30) -> bool:
        """
        Extend authorization expiry
        
        Args:
            domain: Domain to extend
            days: Additional days
        
        Returns:
            bool: True if successful
        """
        domain = domain.lower().strip()
        
        if domain in self.authorizations:
            current_expiry = datetime.fromisoformat(self.authorizations[domain]['expiry'])
            new_expiry = current_expiry + timedelta(days=days)
            self.authorizations[domain]['expiry'] = new_expiry.isoformat()
            self._save_authorizations()
            logger.info(f"Extended authorization for {domain} by {days} days")
            return True
        
        logger.warning(f"Cannot extend: {domain} not found")
        return False
    
    def list_authorizations(self, active_only: bool = True) -> List[Dict]:
        """
        List all authorizations
        
        Args:
            active_only: Only show active authorizations
        
        Returns:
            list: List of authorization records
        """
        active = []
        for domain, auth in self.authorizations.items():
            if active_only and auth.get('status') != 'active':
                continue
            
            expiry = datetime.fromisoformat(auth['expiry'])
            days_remaining = (expiry - datetime.utcnow()).days
            
            active.append({
                'domain': domain,
                'email': auth['email'],
                'added': auth['added'],
                'expiry': auth['expiry'],
                'days_remaining': days_remaining,
                'status': auth.get('status', 'active'),
                'proof_path': auth.get('proof_path', ''),
                'notes': auth.get('notes', '')
            })
        
        return sorted(active, key=lambda x: x['days_remaining'])
    
    def get_expiring_soon(self, days: int = 7) -> List[Dict]:
        """
        Get authorizations expiring soon
        
        Args:
            days: Number of days to consider "soon"
        
        Returns:
            list: List of expiring authorizations
        """
        expiring = []
        for auth in self.list_authorizations(active_only=True):
            if 0 <= auth['days_remaining'] <= days:
                expiring.append(auth)
        return expiring
    
    def export_authorizations(self, output_path: str) -> bool:
        """
        Export authorizations to a file
        
        Args:
            output_path: Path to export file
        
        Returns:
            bool: True if successful
        """
        try:
            output = Path(output_path)
            output.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output, 'w') as f:
                json.dump(self.authorizations, f, indent=2, default=str)
            
            logger.info(f"Exported authorizations to {output_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to export authorizations: {e}")
            return False
    
    def import_authorizations(self, input_path: str, merge: bool = True) -> bool:
        """
        Import authorizations from a file
        
        Args:
            input_path: Path to import file
            merge: Merge with existing (True) or replace (False)
        
        Returns:
            bool: True if successful
        """
        try:
            input_file = Path(input_path)
            if not input_file.exists():
                logger.error(f"Import file not found: {input_path}")
                return False
            
            with open(input_file) as f:
                imported = json.load(f)
            
            if merge:
                self.authorizations.update(imported)
            else:
                self.authorizations = imported
            
            self._save_authorizations()
            logger.info(f"Imported authorizations from {input_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to import authorizations: {e}")
            return False


# Global instance
_auth_manager = None

def get_auth_manager(auth_file: str = "authorizations.json") -> AuthorizationManager:
    """Get or create authorization manager instance"""
    global _auth_manager
    if _auth_manager is None:
        _auth_manager = AuthorizationManager(auth_file)
    return _auth_manager


# Convenience functions
def is_authorized(domain: str) -> Tuple[bool, str]:
    """Check if domain is authorized"""
    manager = get_auth_manager()
    return manager.is_authorized(domain)


def add_authorization(domain: str, email: str, days_valid: int = 30) -> bool:
    """Add authorization"""
    manager = get_auth_manager()
    return manager.add_authorization(domain, email, days_valid)