from .chatgpt import ask, close, check_sessions, reinit_session


class ChatGPT:
    """ChatGPT provider class"""

    def chat(self, prompt: str) -> str:
        return ask(prompt)

    def close(self, session: int | None = None) -> None:
        return close(session)

    def check_sessions(self, session: int | None = None) -> list:
        return check_sessions(session)

    def reinit_session(self, session: int) -> None:
        return reinit_session(session)


__all__ = ["ask", "close", "check_sessions", "reinit_session", "ChatGPT"]
