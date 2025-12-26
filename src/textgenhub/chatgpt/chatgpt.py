"""
ChatGPT provider (new) - thin wrapper over chatgpt-attach CLI
"""
from ..core.provider import SimpleProvider


def ask(
    prompt: str,
    headless: bool = True,
    remove_cache: bool = True,
    debug: bool = False,
    timeout: int = 120,
    typing_speed: float | None = None,
    session: int | None = None,
    close: bool = False,
    max_trials: int = 10,
) -> str:
    """
    Send a prompt to ChatGPT and get a response using the new attach module.

    Args:
        prompt (str): The prompt to send to ChatGPT
        headless (bool): Ignored by attach module (kept for compatibility)
        remove_cache (bool): Ignored by attach module (kept for compatibility)
        debug (bool): Whether to enable debug mode
        timeout (int): Timeout in seconds for the operation
        typing_speed (float | None): Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)
        session (int | None): Specific session index to reuse (when using the attach-based CLI)
        close (bool): Close the browser session after the request completes
        max_trials (int): Maximum number of retries on rate limit (default: 10)

    Returns:
        str: The response from ChatGPT
    """
    provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
    return provider.ask(
        prompt,
        headless=headless,
        remove_cache=remove_cache,
        debug=debug,
        timeout=timeout,
        typing_speed=typing_speed,
        session=session,
        close=close,
        max_trials=max_trials,
    )
