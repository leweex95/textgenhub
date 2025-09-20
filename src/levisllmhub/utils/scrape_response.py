import json


def extract_response_json(stdout: str) -> dict:
    """
    Scan stdout for a JSON line starting with {"response": and return it as a dict.
    Raises ValueError if no valid JSON is found.
    """
    for line in stdout.splitlines():
        line = line.strip()
        if line.startswith('{"response":'):
            return json.loads(line)["response"]
    raise ValueError("No valid JSON response found in Node stdout")
