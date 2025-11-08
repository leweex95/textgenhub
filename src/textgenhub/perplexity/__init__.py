from .perplexity import ask

class Perplexity:
    """Perplexity provider class"""
    def chat(self, prompt: str) -> str:
        return ask(prompt)

__all__ = ['ask', 'Perplexity']
