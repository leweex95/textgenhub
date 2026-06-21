"""
DeepSeek API provider - DeepSeek's official API. 
"""
import os
import argparse
import requests


def ask(
    prompt: str,
    api_key: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
    timeout: int = 120,
    system_prompt: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None, 
) -> str:
    """Send a prompt to DeepSeek API and return the response."""
    api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError(
            "DeepSeek API key is required."
            "Set DEEPSEEK_API_KEY env var or pass api_key= parameter."
        )

    model = model or os.environ.get("DEEPSEEK_MODEL", "deepseek-chat") 
    base_url = base_url or os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.ai/v1")

    url = f"{base_url}/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    body = {"model": model, "messages": messages}
    if temperature is not None:
        body["temperature"] = temperature
    if max_tokens is not None:
        body["max_tokens"] = max_tokens

    try:
        response = requests.post(url, headers=headers, json=body, timeout=timeout)
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(f"Failed to connect to DeepSeek API. Check your internet connection. Error message: {e}")
    
    status_code = response.status_code
    if status_code == 401:
        raise RuntimeError("DeepSeek API authentication failed. Check your API key.")
    if status_code == 429:
        raise RuntimeError("DeepSeek API rate limit exceeded. Try again later.")
    if status_code != 200:
        raise RuntimeError(f"DeepSeek API error {status_code}: {response.text}")
    
    return response.json()["choices"][0]["message"]["content"]


class DeepSeekAPI:
    """DeepSeek API provider class."""

    def __init__(
        self, 
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        system_prompt: str | None = None,
    ):
        self.api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        self.model = model or os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
        self.base_url = base_url or os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.ai/v1")
        self.system_prompt = system_prompt

    def chat(
        self,
        prompt: str,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: int = 120,
    ) -> str:
        "Send a chat prompt and return the response."
        return ask(
            prompt=prompt,
            api_key=self.api_key,
            model=self.model,
            base_url=self.base_url,
            timeout=timeout,
            system_prompt=self.system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepSeek API provider CLI")
    parser.add_argument("--prompt", required=True, help="Prompt to send")
    parser.add_argument("--api_key", default=None, help="API key (default: $DEEPSEEK_API_KEY)")
    parser.add_argument("--model", default=None, help="Model name (default: $DEEPSEEK_MODEL or deepseek-chat)")
    parser.add_argument("--system-prompt", default=None, help="Optional system prompt")
    parser.add_argument("--temperature", type=float, default=None, help="Temperature for response generation")
    parser.add_argument("--max-tokens", type=int, default=None, help="Max output tokens")
    args = parser.parse_args()

    response = ask(
        prompt=args.prompt,
        api_key=args.api_key,
        model=args.model,
        system_prompt=args.system_prompt,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )
    print(response)
