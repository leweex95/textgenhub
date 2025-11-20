"""
ChatGPT provider (new) - thin wrapper over chatgpt-attach CLI
"""
from ..core.provider import SimpleProvider


def ask(prompt: str, headless: bool = True, remove_cache: bool = True, debug: bool = False, timeout: int = 120, typing_speed: float = 0.05) -> str:
    """
    Send a prompt to ChatGPT and get a response using the new attach module.

    Args:
        prompt (str): The prompt to send to ChatGPT
        headless (bool): Ignored by attach module (kept for compatibility)
        remove_cache (bool): Ignored by attach module (kept for compatibility)
        debug (bool): Whether to enable debug mode
        timeout (int): Timeout in seconds for the operation
        typing_speed (float): Typing speed in seconds per character (default: 0.05)

    Returns:
        str: The response from ChatGPT
    """
    provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
    return provider.ask(prompt, headless, remove_cache, debug, timeout, typing_speed)
