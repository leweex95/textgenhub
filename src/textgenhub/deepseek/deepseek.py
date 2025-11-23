"""
DeepSeek provider - Simple and clean implementation
"""
from ..core.provider import SimpleProvider


def ask(prompt: str, headless: bool = True, remove_cache: bool = True, debug: bool = False, timeout: int = 120, typing_speed: float | None = None) -> str:
    """
    Send a prompt to DeepSeek and get a response.

    Args:
        prompt (str): The prompt to send to DeepSeek
        headless (bool): Whether to run browser in headless mode
        remove_cache (bool): Whether to remove browser cache
        debug (bool): Whether to enable debug mode
        timeout (int): Timeout in seconds for the operation
        typing_speed (float | None): Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)

    Returns:
        str: The response from DeepSeek
    """
    provider = SimpleProvider("deepseek", "deepseek_cli.js")
    return provider.ask(prompt, headless, remove_cache, debug, timeout, typing_speed)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DeepSeek CLI via Node.js wrapper")
    parser.add_argument("--prompt", type=str, required=True, help="Prompt to send to DeepSeek")
    parser.add_argument("--headless", type=lambda x: x.lower() == "true", default=True, help="Run Node in headless mode")
    parser.add_argument("--remove-cache", type=lambda x: x.lower() == "false", default=False, help="Remove cache on cleanup")

    args = parser.parse_args()

    resp = ask(args.prompt, headless=args.headless, remove_cache=args.remove_cache)
    print("Response returned from ask method: ", resp)
