"""
core/llm_client.py - Unified LLM Client with Auto-Fallback
Supports: Groq (primary) → Gemini (fallback)
Automatically switches to Gemini when Groq rate limited
"""

import os
import time
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class LLMClient:
    """Unified LLM client with automatic fallback"""
    
    def __init__(self, groq_api_key: str = None, gemini_api_key: str = None):
        from core.config import GROQ_API_KEY, GEMINI_API_KEY, AUTO_FALLBACK
        
        self.groq_api_key = groq_api_key or GROQ_API_KEY
        self.gemini_api_key = gemini_api_key or GEMINI_API_KEY
        self.auto_fallback = AUTO_FALLBACK
        
        # Rate limit tracking
        self.groq_rate_limit_until = None
        self.fallback_count = 0
        
        # Import clients lazily
        self._groq_client = None
        self._gemini_client = None
    
    @property
    def groq_client(self):
        """Lazy load Groq client"""
        if self._groq_client is None and self.groq_api_key:
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=self.groq_api_key)
                logger.info("Groq client initialized")
            except ImportError:
                logger.warning("Groq package not installed - pip install groq")
        return self._groq_client
    
    @property
    def gemini_client(self):
        """Lazy load Gemini client"""
        if self._gemini_client is None and self.gemini_api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_api_key)
                self._gemini_client = genai.GenerativeModel('gemini-2.5-flash-preview-05-20')
                logger.info("Gemini client initialized")
            except ImportError:
                logger.warning("Google AI package not installed - pip install google-generativeai")
        return self._gemini_client
    
    def is_groq_available(self) -> bool:
        """Check if Groq is available (not rate limited)"""
        if not self.groq_api_key:
            return False
        
        if self.groq_rate_limit_until and datetime.now() < self.groq_rate_limit_until:
            remaining = self.groq_rate_limit_until - datetime.now()
            logger.debug(f"Groq rate limited for {remaining.seconds}s more")
            return False
        
        return True
    
    def chat(self, 
             messages: List[Dict[str, str]], 
             model: str = None,
             temperature: float = 0.3,
             max_tokens: int = 4096,
             response_format: str = None,
             **kwargs) -> str:
        """
        Send chat completion with automatic fallback
        
        Args:
            messages: List of {role, content} dicts
            model: Model name (optional, uses default)
            temperature: Sampling temperature
            max_tokens: Max response tokens
            response_format: 'text' or 'json_object'
            
        Returns:
            Assistant response text
        """
        # Try Groq first
        if self.is_groq_available():
            try:
                logger.info("Using Groq for completion")
                return self._chat_groq(
                    messages=messages,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=response_format,
                    **kwargs
                )
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"Groq failed: {error_msg}")
                
                # Check if rate limited
                if 'rate limit' in error_msg.lower() or '429' in error_msg:
                    self._handle_rate_limit(error_msg)
                    
                    # Auto-fallback if enabled
                    if self.auto_fallback and self.gemini_client:
                        logger.info("Auto-falling back to Gemini")
                        self.fallback_count += 1
                        return self._chat_gemini(
                            messages=messages,
                            model=model,
                            temperature=temperature,
                            max_tokens=max_tokens,
                            response_format=response_format,
                            **kwargs
                        )
                
                # Re-raise if not rate limit or no fallback
                raise
        
        # Groq not available, use Gemini
        elif self.gemini_client:
            logger.info("Using Gemini (Groq unavailable)")
            self.fallback_count += 1
            return self._chat_gemini(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                **kwargs
            )
        
        else:
            raise RuntimeError("No LLM available - set GROQ_API_KEY or GEMINI_API_KEY")
    
    def _chat_groq(self, 
                   messages: List[Dict[str, str]],
                   model: str = None,
                   temperature: float = 0.3,
                   max_tokens: int = 4096,
                   response_format: str = None,
                   **kwargs) -> str:
        """Direct Groq API call"""
        from core.config import GROQ_MODEL_DEFAULT
        
        model = model or GROQ_MODEL_DEFAULT
        
        # Prepare request
        request_args = {
            'model': model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
        }
        
        # Add response format if JSON
        if response_format == 'json_object':
            request_args['response_format'] = {'type': 'json_object'}
        
        # Make request
        response = self.groq_client.chat.completions.create(**request_args)
        
        # Parse response
        if not response.choices or not response.choices[0].message.content:
            raise RuntimeError("Empty response from Groq")
        
        return response.choices[0].message.content
    
    def _chat_gemini(self,
                     messages: List[Dict[str, str]],
                     model: str = None,
                     temperature: float = 0.3,
                     max_tokens: int = 4096,
                     response_format: str = None,
                     **kwargs) -> str:
        """Direct Gemini API call"""
        from core.config import GEMINI_MODEL_DEFAULT
        
        # Convert messages to Gemini format
        # Gemini uses different format than OpenAI/Groq
        prompt = ""
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role == 'system':
                prompt += f"System: {content}\n"
            elif role == 'user':
                prompt += f"User: {content}\n"
            elif role == 'assistant':
                prompt += f"Assistant: {content}\n"
        
        # Generate response
        response = self.gemini_client.generate_content(
            prompt,
            generation_config={
                'temperature': temperature,
                'max_output_tokens': max_tokens,
            }
        )
        
        # Parse response
        if not response.text:
            raise RuntimeError("Empty response from Gemini")
        
        return response.text
    
    def _handle_rate_limit(self, error_msg: str):
        """Handle Groq rate limit by setting cooldown"""
        import re
        
        # Try to parse retry-after time from error
        match = re.search(r'try again in (\d+)m', error_msg)
        if match:
            minutes = int(match.group(1))
            self.groq_rate_limit_until = datetime.now() + timedelta(minutes=minutes + 1)
            logger.warning(f"Groq rate limited - waiting {minutes} minutes")
        else:
            # Default 20 minute cooldown
            self.groq_rate_limit_until = datetime.now() + timedelta(minutes=20)
            logger.warning("Groq rate limited - default 20 minute cooldown")
    
    def get_status(self) -> Dict[str, Any]:
        """Get client status"""
        return {
            'groq_available': self.groq_api_key is not None,
            'gemini_available': self.gemini_api_key is not None,
            'groq_rate_limited': not self.is_groq_available(),
            'fallback_count': self.fallback_count,
            'rate_limit_until': self.groq_rate_limit_until.isoformat() if self.groq_rate_limit_until else None,
        }


# Global client instance
_llm_client = None

def get_llm_client() -> LLMClient:
    """Get or create global LLM client"""
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client

def chat_with_fallback(messages: List[Dict[str, str]], **kwargs) -> str:
    """Convenience function for chat with fallback"""
    client = get_llm_client()
    return client.chat(messages, **kwargs)
