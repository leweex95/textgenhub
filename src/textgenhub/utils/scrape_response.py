import json
import re


def extract_response_json(stdout: str) -> str:
    """
    Scan stdout for a JSON line starting with {"response": and return it as a string.
    Removes any leading "ChatGPT said:" if present.
    Raises ValueError if no valid JSON is found.
    """
    for line in stdout.splitlines():
        line = line.strip()
        if line.startswith('{"response":'):
            resp = json.loads(line)["response"]
            # Remove "ChatGPT said:" prefix if present
            resp = re.sub(r"^\s*ChatGPT said:\s*", "", resp, flags=re.IGNORECASE).strip()
            return resp
    raise ValueError("No valid JSON response found in Node stdout")
