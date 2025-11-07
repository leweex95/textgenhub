from .chatgpt import ask

class ChatGPT:
    """ChatGPT provider class"""
    def chat(self, prompt: str) -> str:
        return ask(prompt)

__all__ = ['ask', 'ChatGPT']
