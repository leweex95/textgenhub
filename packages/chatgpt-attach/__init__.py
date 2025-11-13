"""
ChatGPT CLI Python Integration Package

This package provides Python bindings for the ChatGPT CLI tool.
"""

from .chatgpt_cli_wrapper import ChatGPTCLI, query_chatgpt

__version__ = "1.0.0"
__all__ = ["ChatGPTCLI", "query_chatgpt"]
