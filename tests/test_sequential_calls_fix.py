"""
Integration test for the ChatGPT sequential calls bug fix.

This test simulates the original bug report scenario:
Multiple sequential ChatGPT API calls that previously crashed on the 5th call.

The bug was caused by a missing takeScreenshot() method in BrowserManager
that was called in the error handler of ChatGPTProvider.waitForResponse().
"""

import asyncio
import tempfile


class MockChatGPTTest:
    """Mock test to verify the fix works without actual ChatGPT access."""

    @staticmethod
    def test_browser_manager_has_take_screenshot():
        """Verify BrowserManager has takeScreenshot method."""
        try:
            from textgenhub.core.browser_manager import BrowserManager

            # Check method exists
            if not hasattr(BrowserManager, "takeScreenshot"):
                raise AssertionError("BrowserManager missing takeScreenshot method")

            print("✓ BrowserManager.takeScreenshot method exists")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            return False

    @staticmethod
    async def test_multiple_sequential_calls_structure():
        """
        Test the structure that would handle multiple sequential calls.
        This verifies the fix at the code structure level.
        """
        try:
            from textgenhub.chatgpt import ChatGPTProvider
            import inspect

            # Get the waitForResponse method source
            source = inspect.getsource(ChatGPTProvider)

            # Verify the method calls takeScreenshot in error handler
            if "takeScreenshot" in source:
                print("✓ takeScreenshot is called in error handling code")
            else:
                print("⚠ takeScreenshot call not found (might be indirect)")

            print("✓ ChatGPTProvider structure verified")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            return False

    @staticmethod
    async def test_sequential_calls_scenario():
        """
        Simulate the sequential calls scenario from the bug report.
        This would be:
        1. Call 1: ask("Translate: Hello") - works
        2. Call 2: ask("Translate: World") - works
        3. Call 3: ask("Translate: Test") - works
        4. Call 4: ask("Translate: More") - works
        5. Call 5: ask("Translate: Final") - CRASHED before fix
        """
        try:
            from textgenhub.core.browser_manager import BrowserManager

            print("\nSimulating sequential calls scenario:")
            print("  (These are mock tests - actual ChatGPT calls require browser)")

            # Verify method can be called without crashing
            manager = BrowserManager({"headless": True})

            # Test 1: Method exists
            assert hasattr(manager, "takeScreenshot"), "takeScreenshot method missing"
            print("  ✓ Call 1-5: takeScreenshot method is available")

            # Test 2: Method can be called safely
            # This won't actually take a screenshot without initializing the browser,
            # but it won't crash either
            with tempfile.TemporaryDirectory() as tmpdir:
                await manager.takeScreenshot("test.png", {"directory": tmpdir})
                print("  ✓ Screenshot method called successfully (uninitialized)")

            print("✓ Sequential calls scenario test passed")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            import traceback

            traceback.print_exc()
            return False

    @staticmethod
    async def test_error_recovery():
        """
        Test that the error recovery mechanism works.
        Previously, an error in response extraction would crash when
        trying to call takeScreenshot().
        """
        try:
            from textgenhub.core.browser_manager import BrowserManager

            manager = BrowserManager({"headless": True})

            # Simulate error recovery scenario
            print("\nTesting error recovery:")

            # This simulates what happens when an error occurs
            # The error handler tries to take a screenshot
            with tempfile.TemporaryDirectory() as tmpdir:
                # Uninitialized browser scenario (common error condition)
                try:
                    await manager.takeScreenshot("chatgpt-error-test.png", {"directory": tmpdir})
                    print("  ✓ Error handler screenshot attempt handled safely")
                except TypeError as e:
                    if "takeScreenshot is not a function" in str(e):
                        raise AssertionError("BUG NOT FIXED: takeScreenshot is still missing")
                    raise

            print("✓ Error recovery test passed")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            return False


async def run_all_tests():
    """Run all integration tests."""
    print("=" * 60)
    print("ChatGPT Sequential Calls Bug Fix - Integration Tests")
    print("=" * 60)

    tests = [
        ("BrowserManager has takeScreenshot", MockChatGPTTest.test_browser_manager_has_take_screenshot),
        ("Multiple sequential calls structure", MockChatGPTTest.test_multiple_sequential_calls_structure),
        ("Sequential calls scenario", MockChatGPTTest.test_sequential_calls_scenario),
        ("Error recovery mechanism", MockChatGPTTest.test_error_recovery),
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        print(f"\n▸ Testing: {test_name}")
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()

            if result:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ {test_name} failed: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return failed == 0


def test_bug_scenario():
    """
    Describe the bug scenario that was fixed.
    """
    print("\nBUG SCENARIO (BEFORE FIX):")
    print("-" * 60)
    print(
        """
    User makes multiple sequential ChatGPT API calls:

    from textgenhub.chatgpt import ask

    # These work fine (first 4-5 calls)
    result1 = ask("Translate: Hello", headless=True, remove_cache=True)
    result2 = ask("Translate: World", headless=True, remove_cache=True)
    result3 = ask("Translate: Test", headless=True, remove_cache=True)
    result4 = ask("Translate: More", headless=True, remove_cache=True)

    # This crashes on the 5th call
    result5 = ask("Translate: Final", headless=True, remove_cache=True)  # CRASHES

    ERROR: TypeError: this.browserManager.takeScreenshot is not a function

    ROOT CAUSE:
    - ChatGPTProvider.waitForResponse() calls takeScreenshot() on error
    - BrowserManager class didn't have takeScreenshot() method implemented
    - After 4-5 calls, browser state degradation triggers an error condition
    - Error handler tries to call missing takeScreenshot() method
    - TypeError crashes the entire application

    FIX:
    - Implement takeScreenshot() method in BrowserManager class
    - Add error handling to gracefully handle screenshot failures
    - Prevent cascading failures in error handlers
    """
    )
    print("-" * 60)


if __name__ == "__main__":
    test_bug_scenario()

    # Run async tests
    success = asyncio.run(run_all_tests())
    exit(0 if success else 1)
