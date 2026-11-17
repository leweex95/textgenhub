"""
API-key-based proivders.
Each sub-module calls the provider's official REST API.
"""
from .deepseek import ask, DeepSeekAPI

__all__ = ["deepseek", "ask", "DeepSeekAPI"]
