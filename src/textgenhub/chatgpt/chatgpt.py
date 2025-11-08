"""
ChatGPT provider - Simple and clean implementation
"""
from ..core.provider import SimpleProvider


def ask(prompt: str, headless: bool = True, remove_cache: bool = True, debug: bool = False) -> str:
    """
    Send a prompt to ChatGPT and get a response.

    Args:
        prompt (str): The prompt to send to ChatGPT
        headless (bool): Whether to run browser in headless mode
        remove_cache (bool): Whether to remove browser cache
        debug (bool): Whether to enable debug mode

    Returns:
        str: The response from ChatGPT
    """
    provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
    return provider.ask(prompt, headless, remove_cache, debug)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="ChatGPT CLI via Node.js wrapper")
    parser.add_argument("--prompt", type=str, required=True, help="Prompt to send to ChatGPT")
    parser.add_argument("--headless", type=lambda x: x.lower() == "true", default=True, help="Run Node in headless mode")
    parser.add_argument("--remove-cache", type=lambda x: x.lower() == "false", default=False, help="Remove cache on cleanup")
    parser.add_argument("--debug", type=lambda x: x.lower() == "true", default=False, help="Enable debug mode")

    args = parser.parse_args()

    resp = ask(args.prompt, headless=args.headless, remove_cache=args.remove_cache, debug=args.debug)
    print("Response returned from ask method: ", resp)
