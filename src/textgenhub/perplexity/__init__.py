from .perplexity import Perplexity, ask_perplexity

# Unified interface alias
ask = ask_perplexity

__all__ = ['Perplexity', 'ask_perplexity', 'ask']