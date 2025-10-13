from .deepseek import DeepSeek, ask_deepseek

# Unified interface alias
ask = ask_deepseek

__all__ = ['DeepSeek', 'ask_deepseek', 'ask']
