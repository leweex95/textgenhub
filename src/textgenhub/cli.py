#!/usr/bin/env python3
"""
Unified CLI for TextGenHub - routes to different LLM providers
"""
import sys
import argparse
import json
import subprocess
import time
from pathlib import Path
from datetime import datetime
from textgenhub.utils.browser_utils import ensure_chrome_running
## Removed obsolete chatgpt_extension_cli imports


def log_info(message: str):
    """Log an info message"""
    print(f"[INFO] {message}", file=sys.stderr)


def log_error(message: str, error_message: str = None):
    """Log an error message"""
    print(f"[ERROR] {message}", file=sys.stderr)
    if error_message:
        print(f"[ERROR] Details: {error_message}", file=sys.stderr)


def categorize_error(error_message: str) -> str:
    """Categorize error based on error message content"""
    error_lower = error_message.lower()

    if "timeout" in error_lower:
        return "timeout"
    elif "login" in error_lower or "auth" in error_lower:
        return "authentication"
    elif "chrome" in error_lower or "browser" in error_lower:
        return "browser"
    elif "network" in error_lower or "connection" in error_lower:
        return "network"
    elif "json" in error_lower or "parse" in error_lower:
        return "parsing"
    else:
        return "unknown"


def get_error_message(error_type: str) -> dict:
    """Get error message details for a given error type"""
    error_messages = {
        "timeout": {
            "title": "Operation Timeout",
            "description": "The operation took too long to complete.",
            "recovery": "Try increasing the timeout with --timeout parameter or check your internet connection."
        },
        "authentication": {
            "title": "Authentication Error",
            "description": "Failed to authenticate with the service.",
            "recovery": "Check your credentials and ensure you have access to the service."
        },
        "browser": {
            "title": "Browser Error",
            "description": "Issue with browser automation.",
            "recovery": "Ensure Chrome is installed and try restarting the application."
        },
        "network": {
            "title": "Network Error",
            "description": "Network connectivity issue.",
            "recovery": "Check your internet connection and try again."
        },
        "parsing": {
            "title": "Data Parsing Error",
            "description": "Failed to parse response data.",
            "recovery": "This might be a temporary issue. Try again or contact support."
        },
        "unknown": {
            "title": "Unknown Error",
            "description": "An unexpected error occurred.",
            "recovery": "Check the error details and try again. If the problem persists, contact support."
        }
    }

    return error_messages.get(error_type, error_messages["unknown"])


def run_provider_old(provider: str, prompt: str, headless: bool = True, output_format: str = "json", timeout: int = 120, typing_speed: float | None = None):
    """Run using the old headless browser method for any provider"""
    provider_map = {"chatgpt": "chatgpt", "chatgpt_old": "chatgpt_old", "deepseek": "deepseek", "perplexity": "perplexity", "grok": "grok"}

    if provider not in provider_map:
        raise ValueError(f"Unknown provider: {provider}")

    root = Path(__file__).parent
    # Use .cjs extension for old CommonJS scripts, .js for new ES modules
    script_ext = ".cjs" if provider == "chatgpt_old" else ".js"
    script_name = f"{provider_map[provider]}_cli{script_ext}"
    script = root / provider_map[provider] / script_name

    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    cmd = [
        "node",
        str(script),
        "--prompt",
        prompt,
    ]

    # Only add provider-specific flags (not for the new chatgpt attach module)
    if provider != "chatgpt":
        if headless:
            cmd.append("--headless")

        # Add output format flag for providers that support it
        if output_format == "html":
            cmd.extend(["--output-format", "html"])

        # Add typing speed if specified
        if typing_speed is not None:
            cmd.extend(["--typing-speed", str(typing_speed)])

        # Force disable debug output for clean CLI output
        cmd.extend(["--debug", "false"])
    else:
        # For the new chatgpt (attach module), only use supported flags
        cmd.extend(["--timeout", str(timeout)])
        if output_format == "html":
            cmd.append("--html")
        elif output_format == "raw":
            cmd.append("--raw")
        # Add typing speed if specified
        if typing_speed is not None:
            cmd.extend(["--typing-speed", str(typing_speed)])

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=root, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        raise Exception(f"{provider.capitalize()} old method failed:\n{result.stderr}")

    # Try to extract JSON from stdout, ignoring debug output
    stdout_content = (result.stdout or "").strip()

    # Special handling for raw format in chatgpt with --raw flag
    if provider == "chatgpt" and output_format == "raw":
        # In raw mode, filter out JSON log lines and keep only plain text response
        lines = stdout_content.split("\n")
        response_lines = []
        for line in lines:
            line = line.strip()
            if line and not line.startswith("{"):
                # This is not a JSON line, it's part of the response
                response_lines.append(line)
        response_text = "\n".join(response_lines)
        return response_text, ""

    # Use extract_response_json from utils for consistent handling
    try:
        from textgenhub.utils.scrape_response import extract_response_json

        response_text = extract_response_json(stdout_content)
        return response_text, ""
    except ValueError:
        # Fallback to old logic
        # Find the last JSON object in the output
        json_start = stdout_content.rfind("{")
        json_end = stdout_content.rfind("}") + 1

        if json_start >= 0 and json_end > json_start:
            json_str = stdout_content[json_start:json_end]
            try:
                output_data = json.loads(json_str)
                # Handle nested JSON from Node.js scripts
                if isinstance(output_data, dict) and "response" in output_data:
                    response_text = output_data.get("response", "")
                    html_content = output_data.get("html", "")
                else:
                    response_text = str(output_data)
                    html_content = ""
                return response_text, html_content
            except json.JSONDecodeError:
                pass

        # Fallback: return the entire stdout if no JSON found
        return stdout_content, ""


def run_chatgpt_old(prompt: str, headless: bool = True, output_format: str = "json"):
    """Run ChatGPT using the old headless browser method"""
    return run_provider_old("chatgpt_old", prompt, headless, output_format)


def main():
    parser = argparse.ArgumentParser(description="TextGenHub CLI - Unified interface for LLM providers", prog="textgenhub")
    subparsers = parser.add_subparsers(dest="provider", help="LLM provider")

    # ChatGPT subcommand
    chatgpt_parser = subparsers.add_parser("chatgpt", help="ChatGPT via OpenAI")
    chatgpt_parser.add_argument("--prompt", "-p", required=False, help="Prompt to send to ChatGPT (uses rotating questions if not provided)")
    chatgpt_parser.add_argument("--old", action="store_true", help="Use old headless browser method instead of extension")
    chatgpt_parser.add_argument("--timeout", type=int, default=120, help="Timeout in seconds (extension mode only)")
    chatgpt_parser.add_argument("--headless", action="store_true", default=True, help="Run headless (old mode only)")
    chatgpt_parser.add_argument("--output-format", choices=["json", "html", "raw"], default="json", help="Output format (default: json)")
    chatgpt_parser.add_argument("--typing-speed", type=float, default=None, help="Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)")

    # DeepSeek subcommand
    deepseek_parser = subparsers.add_parser("deepseek", help="DeepSeek Chat")
    deepseek_parser.add_argument("--prompt", "-p", required=True, help="Message to send")
    deepseek_parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    deepseek_parser.add_argument("--output-format", choices=["json", "html"], default="json", help="Output format (default: json)")
    deepseek_parser.add_argument("--typing-speed", type=float, default=None, help="Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)")

    # Perplexity subcommand
    perplexity_parser = subparsers.add_parser("perplexity", help="Perplexity AI")
    perplexity_parser.add_argument("--prompt", "-p", required=True, help="Message to send")
    perplexity_parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    perplexity_parser.add_argument("--output-format", choices=["json", "html"], default="json", help="Output format (default: json)")
    perplexity_parser.add_argument("--typing-speed", type=float, default=None, help="Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)")

    # Grok subcommand
    grok_parser = subparsers.add_parser("grok", help="Grok (X.com)")
    grok_parser.add_argument("--prompt", "-p", required=True, help="Message to send")
    grok_parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    grok_parser.add_argument("--output-format", choices=["json", "html"], default="json", help="Output format (default: json)")
    grok_parser.add_argument("--typing-speed", type=float, default=None, help="Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)")

    args = parser.parse_args()

    if not args.provider:
        parser.print_help()
        sys.exit(1)

    try:
        timestamp = datetime.now().isoformat()

        if args.provider == "chatgpt":
            # Use provided prompt or rotating question from JSON
            if args.prompt is not None:
                actual_prompt = args.prompt
                print(f"[ChatGPT] Using provided prompt: {actual_prompt[:60]}...", file=sys.stderr)
            else:
                # Load questions from JSON file and cycle through them
                questions_file = Path(__file__).parent / "questions.json"
                if questions_file.exists():
                    try:
                        with open(questions_file, "r", encoding="utf-8") as f:
                            questions = json.load(f)
                        if not questions:
                            raise ValueError("questions.json is empty")
                        # Use a simple rotation based on current time
                        import time

                        question_index = int(time.time()) % len(questions)
                        actual_prompt = questions[question_index]
                        print(f"[ChatGPT] Using rotating question {question_index + 1}/{len(questions)}: {actual_prompt[:60]}...", file=sys.stderr)
                    except Exception as e:
                        print(f"[ChatGPT] Failed to load questions.json ({e})", file=sys.stderr)
                        print("[ChatGPT] Please ensure questions.json exists and contains valid questions", file=sys.stderr)
                        sys.exit(1)
                else:
                    print("[ChatGPT] questions.json not found", file=sys.stderr)
                    print("[ChatGPT] Please create questions.json with sophisticated prompts about visiting Ukraine during the war", file=sys.stderr)
                    sys.exit(1)

            if args.old:
                log_info("Using old headless method...")
                response_text, html_content = run_chatgpt_old(actual_prompt, args.headless, args.output_format)
                method = "headless-old"
            else:
                # Default to new user-data-persisting browser provider
                response_text, html_content = run_provider_old("chatgpt", actual_prompt, args.headless, args.output_format, args.timeout, args.typing_speed)
                method = "headless"

            if args.output_format == "html":
                # For HTML format, use response_text if it contains HTML, otherwise use html_content
                output_html = response_text if response_text.startswith("<") else html_content
                print(output_html)
            elif args.output_format == "raw":
                # For raw format, just print the response text without any formatting
                print(response_text)
            else:
                # JSON output with metadata
                result = {"provider": "chatgpt", "method": method, "timestamp": timestamp, "prompt": actual_prompt, "response": response_text, "html": html_content}
                print(json.dumps(result, indent=2))

        elif args.provider == "deepseek":
            print("[DeepSeek] Using headless browser method...", file=sys.stderr)
            response_text, html_content = run_provider_old("deepseek", args.prompt, args.headless, args.output_format, timeout=120, typing_speed=args.typing_speed)

            if args.output_format == "html":
                print(html_content)
            else:
                result = {"provider": "deepseek", "method": "headless", "timestamp": timestamp, "prompt": args.prompt, "response": response_text, "html": html_content}
                print(json.dumps(result, indent=2))

        elif args.provider == "perplexity":
            print("[Perplexity] Using headless browser method...", file=sys.stderr)
            response_text, html_content = run_provider_old("perplexity", args.prompt, args.headless, args.output_format, timeout=120, typing_speed=args.typing_speed)

            if args.output_format == "html":
                print(html_content)
            else:
                result = {"provider": "perplexity", "method": "headless", "timestamp": timestamp, "prompt": args.prompt, "response": response_text, "html": html_content}
                print(json.dumps(result, indent=2))

        elif args.provider == "grok":
            print("[Grok] Using headless browser method...", file=sys.stderr)
            response_text, html_content = run_provider_old("grok", args.prompt, args.headless, args.output_format, timeout=120, typing_speed=args.typing_speed)

            if args.output_format == "html":
                print(html_content)
            else:
                result = {"provider": "grok", "method": "headless", "timestamp": timestamp, "prompt": args.prompt, "response": response_text, "html": html_content}
                print(json.dumps(result, indent=2))

    except Exception as e:
        # Categorize and handle error
        error_type = categorize_error(str(e))
        error_info = get_error_message(error_type)

        log_error(f"Operation failed: {error_type}", error_message=str(e))

        print(f"\n❌ {error_info['title']}", file=sys.stderr)
        print(f"{error_info['description']}", file=sys.stderr)
        print(f"Recovery: {error_info['recovery']}\n", file=sys.stderr)

        sys.exit(1)

    # Success
    sys.exit(0)


if __name__ == "__main__":
    main()
