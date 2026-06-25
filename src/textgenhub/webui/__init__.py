"""
Web UI browser-automation providers.
Each sub-module automates the provider's website via Puppeteer.
"""
from . import chatgpt
from . import deepseek
from . import grok
from . import perplexity

from .chatgpt import ChatGPT
from .deepseek import DeepSeek
from .perplexity import Perplexity

__all__ = [
    "chatgpt",
    "deepseek",
    "grok",
    "perplexity",
    "ChatGPT",
    "DeepSeek",
    "Perplexity",
]
