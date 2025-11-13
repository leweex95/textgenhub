"""
ChatGPT CLI Python Wrapper

This module provides a Python interface to the Node.js ChatGPT CLI tool.
"""

import subprocess
import json
from typing import Optional, Any
from pathlib import Path
import sys
import argparse


class ChatGPTCLI:
    """Python wrapper for the ChatGPT CLI tool."""

    def __init__(self, cli_path: Optional[str] = None):
        """
        Initialize the ChatGPT CLI wrapper.

        Args:
            cli_path: Path to the send-prompt-cli.js file. If None, auto-detects from this module's location.
        """
        if cli_path is None:
            # Auto-detect path relative to this wrapper module
            wrapper_dir = Path(__file__).parent
            cli_path = wrapper_dir / "bin" / "send-prompt-cli.js"

        self.cli_path = Path(cli_path)
        if not self.cli_path.exists():
            raise FileNotFoundError("CLI not found at {}".format(self.cli_path))

    def query(self, prompt: str, format_type: str = "json", raw: bool = False, timeout: int = 60, debug: bool = False) -> str:
        """
        Internal method to execute CLI commands. Use ask() instead.

        Args:
            prompt: The prompt to send to ChatGPT
            format_type: Output format ('json' or 'html')
            raw: If True, return raw text without formatting
            timeout: Timeout in seconds
            debug: Enable debug output

        Returns:
            Raw CLI output string
        """
        cmd = ["node", str(self.cli_path), "--prompt", prompt]

        if raw:
            cmd.append("--raw")
        elif format_type == "html":
            cmd.append("--html")
        # json is default, so no flag needed

        if timeout != 60:
            cmd.extend(["--timeout", str(timeout)])

        if debug:
            cmd.append("--debug")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 10, cwd=self.cli_path.parent.parent)  # Add buffer for CLI startup  # Run from the CLI directory

            if result.returncode != 0:
                error_msg = "CLI failed with return code {}".format(result.returncode)
                if result.stderr:
                    error_msg += "\nSTDERR: {}".format(result.stderr)
                raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)

            return result.stdout.strip()

        except subprocess.TimeoutExpired:
            raise TimeoutError("CLI command timed out after {} seconds".format(timeout + 10))

    def ask(self, prompt: str, format: str = "raw", timeout: int = 120, debug: bool = False) -> Any:
        """
        Send a prompt to ChatGPT with flexible output format.

        Args:
            prompt: The prompt to send to ChatGPT
            format: Output format ('raw', 'json', or 'html')
            timeout: Timeout in seconds
            debug: Enable debug output

        Returns:
            Response in the requested format:
            - 'raw': Plain text string
            - 'json': Dict with response metadata
            - 'html': HTML formatted string

        Raises:
            ValueError: If format is not supported
            subprocess.CalledProcessError: If the CLI command fails
        """
        if format == "raw":
            return self.query(prompt, format_type="json", raw=True, timeout=timeout, debug=debug)
        elif format == "json":
            response = self.query(prompt, format_type="json", raw=False, timeout=timeout, debug=debug)
            # Parse the JSON lines (CLI outputs multiple JSON objects)
            lines = response.strip().split("\n")
            result = {}
            for line in lines:
                if line.strip():
                    try:
                        data = json.loads(line)
                        event = data.get("event")
                        if event == "response_received":
                            result.update(data)
                        elif event:
                            result[event] = data
                    except json.JSONDecodeError:
                        continue
            return result
        elif format == "html":
            return self.query(prompt, format_type="html", raw=False, timeout=timeout, debug=debug)
        else:
            raise ValueError("Format must be 'raw', 'json', or 'html'")


# Convenience functions
def query_chatgpt(prompt: str, raw: bool = True, timeout: int = 60) -> str:
    """
    Simple function to query ChatGPT.

    Args:
        prompt: The prompt to send
        raw: If True, return raw text; if False, return JSON
        timeout: Timeout in seconds

    Returns:
        ChatGPT response
    """
    cli = ChatGPTCLI()
    format_type = "raw" if raw else "json"
    return cli.ask(prompt, format=format_type, timeout=timeout)


def ask_chatgpt(prompt: str, format: str = "raw", timeout: int = 120) -> Any:
    """
    Simple function to query ChatGPT with flexible format.

    Args:
        prompt: The prompt to send
        format: Output format ('raw', 'json', or 'html')
        timeout: Timeout in seconds

    Returns:
        ChatGPT response in requested format
    """
    cli = ChatGPTCLI()
    return cli.ask(prompt, format=format, timeout=timeout)


def main():
    """Command-line interface for ChatGPT CLI wrapper."""
    parser = argparse.ArgumentParser(description="ChatGPT CLI Python Wrapper")
    parser.add_argument("--prompt", "-p", required=True, help="The prompt to send to ChatGPT")
    parser.add_argument("--format", "-f", choices=["raw", "json", "html"], default="raw", help="Output format (default: raw)")
    parser.add_argument("--timeout", "-t", type=int, default=120, help="Timeout in seconds (default: 120)")
    parser.add_argument("--debug", "-d", action="store_true", help="Enable debug output")

    args = parser.parse_args()

    try:
        result = ask_chatgpt(args.prompt, format=args.format, timeout=args.timeout)

        if args.format == "json":
            print(json.dumps(result, indent=2))
        else:
            print(result)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
