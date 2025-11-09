#!/usr/bin/env python3
"""
Unified CLI for TextGenHub - routes to different LLM providers
"""
import sys
import argparse
import asyncio
import json
import subprocess
import time
from pathlib import Path
from datetime import datetime
from textgenhub.browser_utils import ensure_chrome_running
from textgenhub.chatgpt_extension_cli.cli.error_handler import categorize_error, get_error_message
from textgenhub.chatgpt_extension_cli.cli.logger import log_info, log_error


def run_chatgpt_extension(message: str, timeout: int = 300, output_format: str = "json"):
    """Run using the new WebSocket-based extension (default)"""
    import websockets
    import uuid

    async def main():
        # CRITICAL: Ensure Chrome is running before attempting connection
        if not ensure_chrome_running():
            raise Exception("Failed to start Chrome. Please ensure Google Chrome is installed.")

        message_id = str(uuid.uuid4())

        try:
            async with websockets.connect("ws://127.0.0.1:8765") as websocket:
                # Send request with message ID
                payload = {"type": "cli_request", "messageId": message_id, "message": message, "output_format": output_format}
                await websocket.send(json.dumps(payload))

                # Wait for ACK
                ack_response = await asyncio.wait_for(websocket.recv(), timeout=5)
                ack_data = json.loads(ack_response)
                if ack_data.get("type") != "ack":
                    raise Exception("Expected ACK from server")
                print("[CLI] Request acknowledged by server", file=sys.stderr)

                # Now wait for actual response (with heartbeat handling)
                start_time = time.time()
                while True:
                    elapsed = time.time() - start_time
                    remaining = timeout - elapsed

                    if remaining <= 0:
                        raise Exception(f"Timeout waiting for response after {timeout}s")

                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=min(remaining, 15))  # Read with timeout
                        data = json.loads(response)

                        if data.get("type") == "response":
                            return data.get("response", "No response"), data.get("html", "")
                        elif data.get("type") == "error":
                            error_msg = data.get("error", "Unknown error")
                            error_type = data.get("error_type", "unknown")
                            raise Exception(f"[{error_type}] {error_msg}")
                        elif data.get("type") == "heartbeat":
                            print("[CLI] Heartbeat received, still processing...", file=sys.stderr)
                            continue
                        else:
                            raise Exception(f"Unexpected response: {data}")
                    except asyncio.TimeoutError:
                        elapsed = time.time() - start_time
                        if elapsed >= timeout:
                            raise Exception(f"Timeout waiting for response after {timeout}s")
                        # Just a read timeout, continue waiting
                        print(f"[CLI] Waiting... ({elapsed:.0f}s elapsed)", file=sys.stderr)
                        continue

        except asyncio.TimeoutError:
            raise Exception(f"Timeout waiting for connection after {timeout}s")
        except ConnectionRefusedError:
            raise Exception("Could not connect to server on ws://127.0.0.1:8765\nMake sure the Windows service ChatGPTServer is running")

    return asyncio.run(main())


def run_provider_old(provider: str, prompt: str, headless: bool = True, output_format: str = "json"):
    """Run using the old headless browser method for any provider"""
    provider_map = {"chatgpt": "chatgpt", "deepseek": "deepseek", "perplexity": "perplexity", "grok": "grok"}

    if provider not in provider_map:
        raise ValueError(f"Unknown provider: {provider}")

    root = Path(__file__).parent
    script_name = f"{provider_map[provider]}_cli.js"
    script = root / provider_map[provider] / script_name

    if not script.exists():
        raise FileNotFoundError(f"Script not found: {script}")

    cmd = [
        "node",
        str(script),
        "--prompt",
        prompt,
    ]
    if headless:
        cmd.append("--headless")

    # Add output format flag for providers that support it
    if output_format == "html":
        cmd.extend(["--output-format", "html"])

    # Force disable debug output for clean CLI output
    cmd.extend(["--debug", "false"])

    result = subprocess.run(cmd, capture_output=True, text=True, cwd=root, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        raise Exception(f"{provider.capitalize()} old method failed:\n{result.stderr}")

    # Try to extract JSON from stdout, ignoring debug output
    stdout_content = (result.stdout or "").strip()

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
    return run_provider_old("chatgpt", prompt, headless, output_format)


def main():
    parser = argparse.ArgumentParser(description="TextGenHub CLI - Unified interface for LLM providers", prog="textgenhub")
    subparsers = parser.add_subparsers(dest="provider", help="LLM provider")

    # ChatGPT subcommand
    chatgpt_parser = subparsers.add_parser("chatgpt", help="ChatGPT via OpenAI")
    chatgpt_parser.add_argument("--prompt", "-p", required=True, help="Message to send to ChatGPT")
    chatgpt_parser.add_argument("--old", action="store_true", help="Use old headless browser method instead of extension")
    chatgpt_parser.add_argument("--timeout", type=int, default=120, help="Timeout in seconds (extension mode only)")
    chatgpt_parser.add_argument("--headless", action="store_true", default=True, help="Run headless (old mode only)")
    chatgpt_parser.add_argument("--output-format", choices=["json", "html"], default="json", help="Output format (default: json)")

    # DeepSeek subcommand
    deepseek_parser = subparsers.add_parser("deepseek", help="DeepSeek Chat")
    deepseek_parser.add_argument("--prompt", "-p", required=True, help="Message to send")
    deepseek_parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    deepseek_parser.add_argument("--output-format", choices=["json", "html"], default="json", help="Output format (default: json)")

    # Perplexity subcommand
    perplexity_parser = subparsers.add_parser("perplexity", help="Perplexity AI")
    perplexity_parser.add_argument("--prompt", "-p", required=True, help="Message to send")
    perplexity_parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    perplexity_parser.add_argument("--output-format", choices=["json", "html"], default="json", help="Output format (default: json)")

    # Grok subcommand
    grok_parser = subparsers.add_parser("grok", help="Grok (X.com)")
    grok_parser.add_argument("--prompt", "-p", required=True, help="Message to send")
    grok_parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    grok_parser.add_argument("--output-format", choices=["json", "html"], default="json", help="Output format (default: json)")

    args = parser.parse_args()

    if not args.provider:
        parser.print_help()
        sys.exit(1)

    try:
        timestamp = datetime.now().isoformat()

        if args.provider == "chatgpt":
            if args.old:
                log_info("Using old headless method...")
                response_text, html_content = run_chatgpt_old(args.prompt, args.headless, args.output_format)
                method = "headless"
            else:
                print("[ChatGPT] Connecting to extension server...", file=sys.stderr)
                response_text, html_content = run_chatgpt_extension(args.prompt, args.timeout, args.output_format)
                method = "extension"

            if args.output_format == "html":
                print(html_content)
            else:
                # JSON output with metadata
                result = {"provider": "chatgpt", "method": method, "timestamp": timestamp, "prompt": args.prompt, "response": response_text, "html": html_content}
                print(json.dumps(result, indent=2))

        elif args.provider == "deepseek":
            print("[DeepSeek] Using headless browser method...", file=sys.stderr)
            response_text, html_content = run_provider_old("deepseek", args.prompt, args.headless, args.output_format)

            if args.output_format == "html":
                print(html_content)
            else:
                result = {"provider": "deepseek", "method": "headless", "timestamp": timestamp, "prompt": args.prompt, "response": response_text, "html": html_content}
                print(json.dumps(result, indent=2))

        elif args.provider == "perplexity":
            print("[Perplexity] Using headless browser method...", file=sys.stderr)
            response_text, html_content = run_provider_old("perplexity", args.prompt, args.headless, args.output_format)

            if args.output_format == "html":
                print(html_content)
            else:
                result = {"provider": "perplexity", "method": "headless", "timestamp": timestamp, "prompt": args.prompt, "response": response_text, "html": html_content}
                print(json.dumps(result, indent=2))

        elif args.provider == "grok":
            print("[Grok] Using headless browser method...", file=sys.stderr)
            response_text, html_content = run_provider_old("grok", args.prompt, args.headless, args.output_format)

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
        sys.exit(1)


if __name__ == "__main__":
    main()
