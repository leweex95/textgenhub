"""
Locally-hosted model providers.
Each sub-module calls a locally running inference server (e.g., Ollama)
"""
from .ollama import ask, Ollama, list_models

__all__ = ["ollama", "Ollama", "list_models"]
