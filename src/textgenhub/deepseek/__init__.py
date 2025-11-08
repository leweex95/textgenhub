from .deepseek import ask


class DeepSeek:
    """DeepSeek provider class"""
    def chat(self, prompt: str) -> str:
        return ask(prompt)


__all__ = ['ask', 'DeepSeek']
