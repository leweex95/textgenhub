"""
Test suite for ChatGPT session management fixes.

This test validates the fixes for:
1. JavaScript context errors in setTextValue
2. Session validation with element availability checks
3. Popup handling with textarea verification
4. Browser state reset with cookie preservation
5. Retry logic for element detection
"""

import asyncio
import sys
from pathlib import Path


class SessionManagementTests:
    """Test suite for session management improvements."""

    @staticmethod
    def test_browser_manager_set_text_value_fix():
        """
        Test that setTextValue uses evaluate with elementHandle instead of $eval.
        This prevents "JavaScript world" errors.
        """
        try:
            # Read the browser-manager.js file
            browser_manager_path = Path(__file__).parent.parent / 'src' / 'textgenhub' / 'core' / 'browser-manager.js'
            with open(browser_manager_path, 'r') as f:
                content = f.read()

            # Check that setTextValue method exists
            assert 'async setTextValue(selector, text)' in content, "setTextValue method not found"

            # Verify it uses elementHandle approach (not $eval which causes JavaScript world errors)
            setTextValue_start = content.find('async setTextValue(selector, text)')
            setTextValue_end = content.find('}\n  }', setTextValue_start) + 4
            setTextValue_code = content[setTextValue_start:setTextValue_end]

            # Should use page.$ and evaluate with elementHandle
            assert 'this.page.$(selector)' in setTextValue_code, "Should use page.$(selector) to get element handle"
            assert 'this.page.evaluate' in setTextValue_code, "Should use page.evaluate"
            assert 'elementHandle' in setTextValue_code, "Should use elementHandle parameter"

            # Should NOT use $eval (which causes JavaScript world errors)
            assert 'this.page.$eval' not in setTextValue_code, "Should NOT use page.$eval (causes JavaScript world errors)"

            # Should dispose the element handle
            assert 'elementHandle.dispose()' in setTextValue_code, "Should dispose elementHandle after use"

            print("✓ setTextValue method fixed to prevent JavaScript world errors")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def test_session_validation_improvements():
        """
        Test that session validation checks element availability, not just time.
        """
        try:
            # Read the chatgpt.js file
            chatgpt_path = Path(__file__).parent.parent / 'src' / 'textgenhub' / 'chatgpt' / 'chatgpt.js'
            with open(chatgpt_path, 'r') as f:
                content = f.read()

            # Find the ensureSessionValid method
            method_start = content.find('async ensureSessionValid()')
            assert method_start > 0, "ensureSessionValid method not found"

            method_end = content.find('\n  }', method_start) + 4
            method_code = content[method_start:method_end]

            # Should check element availability
            assert 'waitForElement' in method_code, "Should check element availability"
            assert 'this.selectors.textArea' in method_code, "Should check for textArea element"

            # Should have recovery logic
            assert 'navigateToUrl' in method_code or 'ensureLoggedIn' in method_code, "Should have recovery logic"

            # Should update lastSessionCheck when element is found
            assert 'this.lastSessionCheck = Date.now()' in method_code, "Should update lastSessionCheck"

            print("✓ Session validation improved with element availability checks")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def test_popup_handling_improvements():
        """
        Test that popup handling waits for textarea to be accessible after dismissal.
        """
        try:
            # Read the chatgpt.js file
            chatgpt_path = Path(__file__).parent.parent / 'src' / 'textgenhub' / 'chatgpt' / 'chatgpt.js'
            with open(chatgpt_path, 'r') as f:
                content = f.read()

            # Find the handleContinueManuallyPrompt method
            method_start = content.find('async handleContinueManuallyPrompt(')
            assert method_start > 0, "handleContinueManuallyPrompt method not found"

            method_end = content.find('\n  }\n', method_start) + 4
            method_code = content[method_start:method_end]

            # Should track if popup was dismissed
            assert 'popupDismissed' in method_code, "Should track popup dismissal state"

            # Should wait for textarea after dismissing popup
            assert 'waitForElement' in method_code, "Should wait for textarea after dismissal"
            assert 'this.selectors.textArea' in method_code, "Should check for textArea"

            # Should verify textarea is accessible before returning
            assert 'textareaAccessible' in method_code or 'canProceed' in method_code, "Should verify textarea accessibility"

            # Should NOT return immediately after clicking (old behavior)
            # Check that there's logic after dismissal
            click_count = method_code.count('.click(')
            return_after_click_count = method_code.count('return true; // Return immediately after successful popup dismissal')

            assert return_after_click_count == 0, "Should NOT return immediately after clicking (should wait for textarea)"

            print("✓ Popup handling improved to verify textarea accessibility")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def test_browser_reset_preserves_cookies():
        """
        Test that browser state reset preserves session cookies.
        """
        try:
            # Read the chatgpt.js file
            chatgpt_path = Path(__file__).parent.parent / 'src' / 'textgenhub' / 'chatgpt' / 'chatgpt.js'
            with open(chatgpt_path, 'r') as f:
                content = f.read()

            # Find the resetBrowserState method
            method_start = content.find('async resetBrowserState()')
            assert method_start > 0, "resetBrowserState method not found"

            method_end = content.find('\n  }', method_start) + 4
            method_code = content[method_start:method_end]

            # Should save cookies before closing page
            assert 'page.cookies()' in method_code, "Should save cookies before closing page"

            # Should restore cookies after creating new page
            assert 'setCookie' in method_code, "Should restore cookies after creating new page"

            # Should check if cookies exist before restoring
            assert 'cookies.length' in method_code, "Should check if cookies exist"

            print("✓ Browser reset now preserves session cookies")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def test_retry_logic_for_text_input():
        """
        Test that text input has retry logic for robustness.
        """
        try:
            # Read the chatgpt.js file
            chatgpt_path = Path(__file__).parent.parent / 'src' / 'textgenhub' / 'chatgpt' / 'chatgpt.js'
            with open(chatgpt_path, 'r') as f:
                content = f.read()

            # Find the section where prompt is set (in generateContent method)
            prompt_section_start = content.find('// Clear any existing text and type the prompt')
            assert prompt_section_start > 0, "Prompt input section not found"

            # Get a reasonable chunk of code after this comment
            prompt_section_end = prompt_section_start + 2000
            prompt_section = content[prompt_section_start:prompt_section_end]

            # Should have retry loop
            assert 'maxPromptAttempts' in prompt_section, "Should have maxPromptAttempts for retry"
            assert 'for (let attempt' in prompt_section, "Should have retry loop"

            # Should track if prompt was set
            assert 'promptSet' in prompt_section, "Should track if prompt was set successfully"

            # Should retry on failure
            assert 'attempt < maxPromptAttempts' in prompt_section, "Should retry on failure"

            print("✓ Text input has retry logic for robustness")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def test_element_detection_retry_logic():
        """
        Test that element detection has retry logic.
        """
        try:
            # Read the chatgpt.js file
            chatgpt_path = Path(__file__).parent.parent / 'src' / 'textgenhub' / 'chatgpt' / 'chatgpt.js'
            with open(chatgpt_path, 'r') as f:
                content = f.read()

            # Find the section where text area is detected (in generateContent method)
            detection_section_start = content.find('// Try to find text area, reset browser state if not found')
            assert detection_section_start > 0, "Element detection section not found"

            # Get a reasonable chunk of code after this comment
            detection_section_end = detection_section_start + 1500
            detection_section = content[detection_section_start:detection_section_end]

            # Should have retry loop
            assert 'maxAttempts' in detection_section, "Should have maxAttempts for retry"
            assert 'for (let attempt' in detection_section, "Should have retry loop"

            # Should track if element was found
            assert 'textAreaFound' in detection_section, "Should track if element was found"

            # Should reset browser state on failure
            assert 'resetBrowserState' in detection_section, "Should reset browser state on failure"

            print("✓ Element detection has retry logic")
            return True
        except Exception as e:
            print(f"✗ Failed: {e}")
            import traceback
            traceback.print_exc()
            return False


def run_all_tests():
    """Run all session management tests."""
    print("=" * 70)
    print("ChatGPT Session Management Fixes - Validation Tests")
    print("=" * 70)

    tests = [
        ("JavaScript context error fix (setTextValue)",
         SessionManagementTests.test_browser_manager_set_text_value_fix),
        ("Session validation improvements",
         SessionManagementTests.test_session_validation_improvements),
        ("Popup handling improvements",
         SessionManagementTests.test_popup_handling_improvements),
        ("Browser reset preserves cookies",
         SessionManagementTests.test_browser_reset_preserves_cookies),
        ("Text input retry logic",
         SessionManagementTests.test_retry_logic_for_text_input),
        ("Element detection retry logic",
         SessionManagementTests.test_element_detection_retry_logic),
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        print(f"\n▸ Testing: {test_name}")
        try:
            result = test_func()
            if result:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ {test_name} failed: {e}")
            failed += 1

    print("\n" + "=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70)

    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
