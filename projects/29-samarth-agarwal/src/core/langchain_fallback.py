"""
core/langchain_fallback.py - LangChain LLM with Groq→Gemini Fallback
Wraps ChatGroq and ChatGoogleGenerativeAI with automatic fallback
"""

import logging
from typing import Any, List, Optional
from datetime import datetime, timedelta
import re

logger = logging.getLogger(__name__)

class FallbackLLM:
    """
    LangChain-compatible LLM wrapper with automatic Groq→Gemini fallback
    
    Usage:
        llm = FallbackLLM()
        response = llm.invoke("Your prompt")
        # OR for chains:
        chain = prompt | llm | output_parser
    """
    
    def __init__(self, groq_api_key: str = None, gemini_api_key: str = None, 
                 default_model: str = None, fallback_model: str = None):
        from core.config import (
            GROQ_API_KEY, GEMINI_API_KEY,
            GROQ_MODEL_DEFAULT, GEMINI_MODEL_DEFAULT
        )
        
        self.groq_api_key = groq_api_key or GROQ_API_KEY
        self.gemini_api_key = gemini_api_key or GEMINI_API_KEY
        self.default_model = default_model or GROQ_MODEL_DEFAULT
        self.fallback_model = fallback_model or GEMINI_MODEL_DEFAULT
        
        # Rate limit tracking
        self.groq_rate_limit_until = None
        self.fallback_count = 0
        self.total_calls = 0
        
        # Lazy-loaded clients
        self._groq_llm = None
        self._gemini_llm = None
        
        # Initialize primary LLM
        self._init_groq()
    
    def _init_groq(self):
        """Initialize Groq LLM"""
        if self.groq_api_key:
            try:
                from langchain_groq import ChatGroq
                self._groq_llm = ChatGroq(
                    model=self.default_model,
                    api_key=self.groq_api_key,
                    temperature=0.3,
                    max_tokens=4096,
                )
                logger.info(f"Groq LLM initialized: {self.default_model}")
            except ImportError:
                logger.warning("langchain_groq not installed")
                self._groq_llm = None
    
    def _init_gemini(self):
        """Initialize Gemini LLM"""
        if self.gemini_api_key and self._gemini_llm is None:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                self._gemini_llm = ChatGoogleGenerativeAI(
                    model=self.fallback_model,
                    google_api_key=self.gemini_api_key,
                    temperature=0.3,
                    max_output_tokens=4096,
                )
                logger.info(f"Gemini LLM initialized: {self.fallback_model}")
            except ImportError:
                logger.warning("langchain_google_genai not installed - pip install langchain-google-genai")
                self._gemini_llm = None
    
    @property
    def current_llm(self):
        """Get current active LLM (Groq or Gemini)"""
        if self._groq_llm and self.is_groq_available():
            return self._groq_llm
        elif self._gemini_llm:
            return self._gemini_llm
        else:
            raise RuntimeError("No LLM available")
    
    def is_groq_available(self) -> bool:
        """Check if Groq is available"""
        if not self._groq_llm:
            return False
        
        if self.groq_rate_limit_until and datetime.now() < self.groq_rate_limit_until:
            remaining = self.groq_rate_limit_until - datetime.now()
            logger.debug(f"Groq rate limited for {remaining.seconds}s more")
            return False
        
        return True
    
    def invoke(self, input: Any, **kwargs) -> Any:
        """Invoke LLM with automatic fallback"""
        self.total_calls += 1
        
        # Try Groq first
        if self.is_groq_available() and self._groq_llm:
            try:
                logger.debug(f"Using Groq (call {self.total_calls})")
                return self._groq_llm.invoke(input, **kwargs)
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"Groq failed: {error_msg}")
                
                # Check if rate limited
                if self._is_rate_limit_error(error_msg):
                    self._handle_rate_limit(error_msg)
                    
                    # Fallback to Gemini
                    if self._gemini_llm:
                        logger.info("Auto-falling back to Gemini")
                        self.fallback_count += 1
                        return self._gemini_llm.invoke(input, **kwargs)
                
                # Re-raise if not rate limit
                raise
        
        # Use Gemini if Groq unavailable
        elif self._gemini_llm:
            logger.info(f"Using Gemini (Groq unavailable, call {self.total_calls})")
            self.fallback_count += 1
            return self._gemini_llm.invoke(input, **kwargs)
        
        else:
            raise RuntimeError("No LLM available - set GROQ_API_KEY or GEMINI_API_KEY")
    
    def stream(self, input: Any, **kwargs):
        """Stream LLM response with fallback"""
        # Similar to invoke but streams
        llm = self.current_llm
        return llm.stream(input, **kwargs)
    
    def batch(self, inputs: List[Any], **kwargs) -> List[Any]:
        """Batch invoke with fallback"""
        llm = self.current_llm
        return llm.batch(inputs, **kwargs)
    
    def _is_rate_limit_error(self, error_msg: str) -> bool:
        """Check if error is rate limit"""
        error_lower = error_msg.lower()
        return ('rate limit' in error_lower or 
                '429' in error_msg or 
                'too many requests' in error_lower)
    
    def _handle_rate_limit(self, error_msg: str):
        """Handle rate limit by setting cooldown"""
        match = re.search(r'try again in (\d+)m', error_msg)
        if match:
            minutes = int(match.group(1))
            self.groq_rate_limit_until = datetime.now() + timedelta(minutes=minutes + 1)
            logger.warning(f"Groq rate limited - waiting {minutes} minutes")
        else:
            # Default 20 minute cooldown
            self.groq_rate_limit_until = datetime.now() + timedelta(minutes=20)
            logger.warning("Groq rate limited - default 20 minute cooldown")
    
    def get_status(self) -> dict:
        """Get LLM status"""
        return {
            'groq_available': self._groq_llm is not None,
            'gemini_available': self._gemini_llm is not None,
            'using_gemini': not self.is_groq_available(),
            'fallback_count': self.fallback_count,
            'total_calls': self.total_calls,
            'rate_limit_until': self.groq_rate_limit_until.isoformat() if self.groq_rate_limit_until else None,
        }
    
    # LangChain compatibility methods
    def __call__(self, prompt: str, **kwargs):
        """Direct call compatibility"""
        return self.invoke(prompt, **kwargs)

    def bind_tools(self, tools, **kwargs):
        """Bind tools for agent execution - delegates to current LLM"""
        llm = self.current_llm
        if hasattr(llm, 'bind_tools'):
            return llm.bind_tools(tools, **kwargs)
        # Fallback for LLMs without native bind_tools
        if hasattr(llm, 'with_structured_output'):
            return llm
        raise RuntimeError("Current LLM does not support tool binding")

    @property
    def model_name(self):
        """Get current model name"""
        llm = self.current_llm
        if hasattr(llm, 'model_name'):
            return llm.model_name
        return 'unknown'


def create_fallback_llm(**kwargs) -> FallbackLLM:
    """Create fallback LLM instance"""
    return FallbackLLM(**kwargs)
