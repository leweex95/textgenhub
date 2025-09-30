import subprocess
from pathlib import Path
import json
import sys
from ..utils.scrape_response import extract_response_json

NODE_PATH = "node"
PERPLEXITY_CLI = Path(__file__).parent / "perplexity_cli.js"


def ask_perplexity(prompt: str, headless: bool = True, remove_cache: bool = True) -> str:
    import subprocess
    stdout_json_line = None

    cmd = [
        NODE_PATH,
        str(PERPLEXITY_CLI),
        "--prompt", prompt,
        "--headless", str(headless).lower(),
        "--remove-cache", str(remove_cache).lower()
    ]

    with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=PERPLEXITY_CLI.parent) as proc:
        # first, read bytes directly and attempt to encode them in UTF-8
        raw_bytes = proc.stdout.read()
        try:
            text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError as e:
            print(f"UnicodeDecodeError at byte {e.start}, replacing invalid bytes")
            text = raw_bytes.decode("utf-8", errors="replace")

        for line in text.splitlines():
            print(line)  # shows all Node logs live
            if line.strip().startswith('{"response":'):
                stdout_json_line = line.strip()

        proc.wait()

    if not stdout_json_line:
        raise RuntimeError("Node script did not produce JSON response")

    return extract_response_json(stdout_json_line)


class Perplexity:
    """
    Perplexity AI interface for generating responses
    """

    def __init__(self):
        pass

    def chat(self, prompt: str, headless: bool = True, remove_cache: bool = True) -> str:
        """
        Send a prompt to Perplexity AI and get a response

        Args:
            prompt (str): The prompt to send to Perplexity AI
            headless (bool): Whether to run browser in headless mode
            remove_cache (bool): Whether to remove browser cache

        Returns:
            str: The response from Perplexity AI
        """
        return ask_perplexity(prompt, headless=headless, remove_cache=remove_cache)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Perplexity AI CLI via Node.js wrapper")
    parser.add_argument("--prompt", type=str, required=True, help="Prompt to send to Perplexity AI")
    parser.add_argument("--headless", type=lambda x: x.lower() == "true", default=True, help="Run Node in headless mode")
    parser.add_argument("--remove-cache", type=lambda x: x.lower() == "true", default=True, help="Remove cache on cleanup")

    args = parser.parse_args()

    resp = ask_perplexity(args.prompt, headless=args.headless, remove_cache=args.remove_cache)
    print(resp)