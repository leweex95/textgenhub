import json
import re


def extract_response_json(stdout: str) -> str:
    """
    Scan stdout for a JSON object containing a string response.
    Supports pretty-printed JSON and preceding log output. Removes any leading
    "ChatGPT said:" from the extracted response.
    Raises ValueError if no valid JSON is found.
    """
    decoder = json.JSONDecoder()
    for index, char in enumerate(stdout):
        if char != "{":
            continue
        try:
            candidate, _end = decoder.raw_decode(stdout, index)
        except json.JSONDecodeError:
            continue
        if isinstance(candidate, dict) and isinstance(candidate.get("response"), str):
            # Remove "ChatGPT said:" prefix if present.
            return re.sub(
                r"^\s*ChatGPT said:\s*", "", candidate["response"], flags=re.IGNORECASE
            ).strip()
    raise ValueError("No valid JSON response found in Node stdout")
