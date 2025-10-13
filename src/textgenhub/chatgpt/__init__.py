from .chatgpt import ask_chatgpt, create_chatgpt_session, ChatGPTSession, ChatGPT

# Unified interface alias
ask = ask_chatgpt

__all__ = ['ask_chatgpt', 'create_chatgpt_session', 'ChatGPTSession', 'ChatGPT', 'ask']