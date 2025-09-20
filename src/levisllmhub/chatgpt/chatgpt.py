import subprocess
from pathlib import Path
import json
import sys

NODE_PATH = "node"
CHATGPT_CLI = Path("src/levisllmhub/chatgpt_cli.js").resolve()

def ask_chatgpt(prompt: str, headless: bool = True) -> str:
    cmd = [
        NODE_PATH,
        str(CHATGPT_CLI),
        "--prompt", prompt,
        "--headless", str(headless).lower()
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            cwd=CHATGPT_CLI.parent  # <-- Run Node from the folder where chatgpt_cli.js lives
        )
        print("stdout:", result.stdout)
        print("stderr:", result.stderr)
        data = json.loads(result.stdout.strip())
        return data["response"]
    except subprocess.CalledProcessError as e:
        print("Error running Node script:", e.stderr, file=sys.stderr)
        raise
    except json.JSONDecodeError:
        print("Invalid JSON output:", result.stdout, file=sys.stderr)
        raise
