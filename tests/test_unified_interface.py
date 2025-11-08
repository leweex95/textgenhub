"""
Test unified interface for all providers
"""
import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_unified_ask_interface():
    """Test that all providers have a unified ask() method"""
    from textgenhub import chatgpt, deepseek, perplexity

    # All modules should have an ask() method
    assert hasattr(chatgpt, "ask"), "chatgpt module should have ask() method"
    assert hasattr(deepseek, "ask"), "deepseek module should have ask() method"
    assert hasattr(perplexity, "ask"), "perplexity module should have ask() method"

    # Verify they are callable
    assert callable(chatgpt.ask), "chatgpt.ask should be callable"
    assert callable(deepseek.ask), "deepseek.ask should be callable"
    assert callable(perplexity.ask), "perplexity.ask should be callable"


def test_provider_classes():
    """Test that all provider classes exist and can be instantiated"""
    from textgenhub import ChatGPT, DeepSeek, Perplexity

    # All classes should be importable
    assert ChatGPT is not None, "ChatGPT class should be importable"
    assert DeepSeek is not None, "DeepSeek class should be importable"
    assert Perplexity is not None, "Perplexity class should be importable"

    # All classes should be instantiable
    chatgpt = ChatGPT()
    deepseek = DeepSeek()
    perplexity = Perplexity()

    # All instances should have a chat() method
    assert hasattr(chatgpt, "chat"), "ChatGPT should have chat() method"
    assert hasattr(deepseek, "chat"), "DeepSeek should have chat() method"
    assert hasattr(perplexity, "chat"), "Perplexity should have chat() method"


def test_deepseek_functions():
    """Test that DeepSeek module has required functions"""
    from textgenhub.deepseek import ask, DeepSeek

    assert callable(ask), "ask should be callable"
    assert DeepSeek is not None, "DeepSeek class should exist"


def test_module_level_imports():
    """Test that the user's desired usage patterns work"""
    # Pattern 1: textgenhub.chatgpt.ask()
    from textgenhub import chatgpt

    assert hasattr(chatgpt, "ask"), "textgenhub.chatgpt should have ask()"

    # Pattern 2: textgenhub.deepseek.ask()
    from textgenhub import deepseek

    assert hasattr(deepseek, "ask"), "textgenhub.deepseek should have ask()"

    # Pattern 3: textgenhub.perplexity.ask()
    from textgenhub import perplexity

    assert hasattr(perplexity, "ask"), "textgenhub.perplexity should have ask()"


if __name__ == "__main__":
    print("Running unified interface tests...")

    test_unified_ask_interface()
    print("✓ test_unified_ask_interface passed")

    test_provider_classes()
    print("✓ test_provider_classes passed")

    test_deepseek_functions()
    print("✓ test_deepseek_functions passed")

    test_module_level_imports()
    print("✓ test_module_level_imports passed")

    print("\nAll tests passed! ✓")
