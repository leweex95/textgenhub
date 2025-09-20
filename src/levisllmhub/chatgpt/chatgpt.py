import subprocess
from pathlib import Path
import json
import sys
from levisLLMhub.utils.scrape_response import extract_response_json

NODE_PATH = "node"
CHATGPT_CLI = Path(__file__).parent / "chatgpt_cli.js"


def ask_chatgpt(prompt: str, headless: bool = True) -> str:
    import subprocess
    stdout_json_line = None

    cmd = [
        NODE_PATH,
        str(CHATGPT_CLI),
        "--prompt", prompt,
        "--headless", str(headless).lower()
    ]

    with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=CHATGPT_CLI.parent) as proc:
        for line in proc.stdout:
            print(line, end="")  # shows all Node logs live
            if line.strip().startswith('{"response":'):
                stdout_json_line = line.strip()

        proc.wait()

    if not stdout_json_line:
        raise RuntimeError("Node script did not produce JSON response")

    return extract_response_json(stdout_json_line)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="ChatGPT CLI via Node.js wrapper")
    parser.add_argument("--prompt", type=str, required=True, help="Prompt to send to ChatGPT")
    parser.add_argument("--headless", action="store_true", help="Run Node in headless mode")
    args = parser.parse_args()

    resp = ask_chatgpt(args.prompt, headless=args.headless)
    print(resp)
