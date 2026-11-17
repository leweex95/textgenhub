from .chatgpt import ask, close


class ChatGPT:
    """ChatGPT provider class"""

    def chat(self, prompt: str) -> str:
        return ask(prompt)

    def close(self, session: int | None = None) -> None:
        return close(session)


__all__ = ["ask", "ChatGPT"]
