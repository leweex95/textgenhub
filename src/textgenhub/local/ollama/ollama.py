"""
Ollama provider - locally-hosted LLM via Ollama REST API.
"""
import os
import argparse
import requests


def ask(
    prompt: str,
    model: str | None = None,
    host: str | None = None,
    port: int | None = None,
    timeout: int = 120,
    system_prompt: str | None = None,
) -> str:
    """Send a prompt to a local Ollama instance and return the response."""
    model = model or os.environ.get("OLLAMA_MODEL", "llama3")
    host = host or os.environ.get("OLLAMA_HOST", "localhost")
    port = port if port is not None else int(os.environ.get("OLLAMA_PORT", "11434"))

    url = f"http://{host}:{port}/api/chat"

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }

    try:
        response = requests.post(url, json=payload, timeout=timeout)
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(
            f"Failed to connect to Ollama at {url}. "
            "Is Ollama running? Start it with `ollama serve`."
        ) from e

    if response.status_code != 200:
        raise RuntimeError(
            f"Ollama API error (HTTP {response.status_code}): {response.text}"
        )

    response_json = response.json()
    return response_json["message"]["content"]


class Ollama:
    """Ollama provider class."""

    def __init__(
        self,
        model: str | None = None,
        host: str | None = None,
        port: int | None = None,
    ):
        self.model = model or os.environ.get("OLLAMA_MODEL", "llama3")
        self.host = host or os.environ.get("OLLAMA_HOST", "localhost")
        self.port = port if port is not None else int(os.environ.get("OLLAMA_PORT", "11434"))

    def chat(
        self,
        prompt: str,
        system_prompt: str | None = None,
        timeout: int = 120,
    ) -> str:
        """Send a chat prompt and return the response."""
        return ask(
            prompt=prompt,
            model=self.model,
            host=self.host,
            port=self.port,
            timeout=timeout,
            system_prompt=system_prompt,
        )


def list_models(
    host: str | None = None,
    port: int | None = None,
) -> list[str]:
    """List available Ollama models. Returns empty list on failure."""
    host = host or os.environ.get("OLLAMA_HOST", "localhost")
    port = port if port is not None else int(os.environ.get("OLLAMA_PORT", "11434"))

    url = f"http://{host}:{port}/api/tags"

    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return []
        data = response.json()
        return sorted(m["name"] for m in data.get("models", []))
    except Exception:
        return []


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ollama provider CLI")
    parser.add_argument("--prompt", required=True, help="Prompt to send")
    parser.add_argument("--model", default=None, help="Model name (default: $OLLAMA_MODEL or llama3)")
    parser.add_argument("--host", default=None, help="Ollama host (default: $OLLAMA_HOST or localhost)")
    parser.add_argument("--port", type=int, default=None, help="Ollama port (default: $OLLAMA_PORT or 11434)")
    parser.add_argument("--system-prompt", default=None, help="Optional system prompt")
    args = parser.parse_args()

    response = ask(
        args.prompt,
        model=args.model,
        host=args.host,
        port=args.port,
        system_prompt=args.system_prompt,
    )
    print(response)
