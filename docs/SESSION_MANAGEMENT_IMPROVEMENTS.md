# ChatGPT Provider Session Management Improvements

## Overview

This document describes the critical session management improvements made to the ChatGPT provider in textgenhub to address reliability issues in automated pipelines.

## Issues Resolved

### 1. JavaScript Context Errors ("Argument should belong to the same JavaScript world")

**Problem:** The `setTextValue` method in BrowserManager used `page.$eval()` which caused JavaScript context errors when dealing with cross-origin iframes or isolated JavaScript contexts.

**Solution:** Refactored to use `page.$()` to get an element handle, then `page.evaluate()` with the element handle as a parameter. This ensures the element and the JavaScript code are in the same execution context.

**Code Changes:**
- File: `src/textgenhub/core/browser-manager.js`
- Method: `setTextValue()`
- Changed from: `await this.page.$eval(selector, (element, newText) => {...}, text)`
- Changed to: `const elementHandle = await this.page.$(selector); await this.page.evaluate((element, newText) => {...}, elementHandle, text);`

### 2. Session Validation Improvements

**Problem:** Session validation only checked time-based expiration (`lastSessionCheck` timestamp) but didn't verify if the text area element was still accessible. This caused failures when the session appeared valid but the UI state had changed.

**Solution:** Enhanced `ensureSessionValid()` to perform both time-based and element-based validation. If the text area is not found, it attempts recovery by navigating back to the chat page before requiring full re-login.

**Code Changes:**
- File: `src/textgenhub/chatgpt/chatgpt.js`
- Method: `ensureSessionValid()`
- Added: Element availability check with `waitForElement(this.selectors.textArea)`
- Added: Recovery logic with navigation fallback

### 3. Popup Handling Enhancements

**Problem:** Popup dismissal returned immediately after clicking, without verifying that the text area became accessible. This caused subsequent operations to fail if the popup dismissal was slow or incomplete.

**Solution:** Modified popup handling to track dismissal state and verify text area accessibility before returning. The handler now waits for the text area to be ready after dismissing any popup.

**Code Changes:**
- File: `src/textgenhub/chatgpt/chatgpt.js`
- Method: `handleContinueManuallyPrompt()`
- Added: `popupDismissed` flag to track dismissal state
- Added: Text area verification after popup dismissal
- Changed: No longer returns immediately after clicking buttons

### 4. Browser State Reset with Cookie Preservation

**Problem:** Browser state reset closed and reopened pages but lost session cookies, forcing re-authentication and causing session continuity issues.

**Solution:** Modified `resetBrowserState()` to save cookies before closing the page and restore them after creating a new page. This preserves the session state across browser resets.

**Code Changes:**
- File: `src/textgenhub/chatgpt/chatgpt.js`
- Method: `resetBrowserState()`
- Added: `const cookies = await this.browserManager.page.cookies()`
- Added: `await this.browserManager.page.setCookie(...cookies)`

### 5. Retry Logic for Element Detection and Text Input

**Problem:** Single-attempt operations failed immediately on transient issues (network delays, UI rendering, popups).

**Solution:** Added retry loops with configurable max attempts for both element detection and text input operations. Each retry includes popup handling and appropriate delays.

**Code Changes:**
- File: `src/textgenhub/chatgpt/chatgpt.js`
- Method: `generateContent()`
- Added: Text area detection retry loop (max 2 attempts with browser reset)
- Added: Prompt input retry loop (max 3 attempts with popup handling)

## Usage Recommendations

### For Single Calls

```python
from textgenhub.chatgpt import ask

result = ask("Your prompt here", headless=True, remove_cache=True)
```

### For Sequential Calls

```python
from textgenhub.chatgpt import ask
import time

# Add small delays between calls to allow browser stabilization
results = []
for i, prompt in enumerate(prompts):
    try:
        result = ask(prompt, headless=True, remove_cache=False)  # Keep cache for better session persistence
        results.append(result)
        
        # Small delay between calls (helps with rate limiting and stability)
        if i < len(prompts) - 1:
            time.sleep(2)
    except Exception as e:
        print(f"Error on prompt {i}: {e}")
        # Optionally implement exponential backoff
        time.sleep(2 ** (i % 3))
```

### Configuration Tips

1. **Session Timeout**: The default session timeout is 1 hour (3600000ms). For long-running operations, consider keeping the default or increasing it:
   ```python
   # This is handled internally by the provider
   # No user configuration needed
   ```

2. **Cache Management**: For sequential calls in the same session, set `remove_cache=False` to maintain session state:
   ```python
   # First call
   result1 = ask("Hello", headless=True, remove_cache=True)
   
   # Subsequent calls in same session
   result2 = ask("World", headless=True, remove_cache=False)
   result3 = ask("Test", headless=True, remove_cache=False)
   ```

3. **Debug Mode**: Enable debug mode for detailed logging when troubleshooting:
   ```python
   result = ask("Your prompt", headless=True, debug=True)
   ```

## Error Recovery

The provider now includes several automatic recovery mechanisms:

1. **Session Recovery**: If text area is not found but session appears valid, automatically navigates to chat page
2. **Browser Reset**: If element detection fails, automatically resets browser state while preserving cookies
3. **Popup Auto-Dismissal**: Automatically detects and dismisses login/authentication popups
4. **Retry on Transient Errors**: Retries operations that may fail due to timing or network issues

## Testing

A comprehensive test suite has been added to validate these improvements:

```bash
# Run the validation tests
python tests/test_session_management_fix.py
```

The test suite validates:
- JavaScript context error fix in setTextValue
- Session validation with element availability checks
- Popup handling improvements
- Cookie preservation in browser reset
- Retry logic for text input
- Retry logic for element detection

All tests should pass, confirming the fixes are working as expected.

## Known Limitations

1. **Headless Mode**: Manual login is not possible in headless mode. Ensure you have a valid session or use non-headless mode for initial setup
2. **Rate Limiting**: ChatGPT may rate-limit frequent requests. Use appropriate delays between calls
3. **UI Changes**: ChatGPT's web interface may change, requiring selector updates. The provider uses multiple fallback selectors to mitigate this

## Migration Notes

These changes are backward compatible. No code changes are required for existing users. The improvements are internal and transparent to the API.

## Technical Details

### Element Selectors

The provider uses multiple fallback selectors to handle ChatGPT UI changes:

```javascript
textArea: '#prompt-textarea, [data-testid="composer-text-input"], textarea[placeholder*="Message"], textarea[data-id="root"]'
```

If one selector fails, the next is tried automatically.

### Session State Management

Session state is tracked using two mechanisms:
1. **Time-based**: `lastSessionCheck` timestamp compared against `sessionTimeout`
2. **Element-based**: Actual verification that text area element exists and is visible

Both must be satisfied for a session to be considered valid.

### Error Handling Flow

```
Operation Attempt
    ├─> Success → Return result
    └─> Failure
        ├─> Check for popups → Dismiss if found
        ├─> Retry (if attempts remaining)
        │   ├─> Small delay (1s)
        │   └─> Attempt again
        └─> Final failure
            ├─> Reset browser state (preserve cookies)
            └─> Throw error with context
```

## Support

For issues or questions:
1. Enable debug mode: `ask(prompt, debug=True)`
2. Check logs for detailed error messages
3. Review screenshots in the `screenshots/` directory (if generated)
4. Check artifacts in the `artifacts/` directory for HTML snapshots on errors
