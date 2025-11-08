#!/usr/bin/env python3
"""
Error handling and recovery for ChatGPT extension CLI
"""


class ChatGPTExtensionError(Exception):
    """Base exception for ChatGPT extension"""

    def __init__(self, message, error_type="unknown", is_recoverable=False):
        self.message = message
        self.error_type = error_type
        self.is_recoverable = is_recoverable
        super().__init__(message)

    def __str__(self):
        return f"[{self.error_type}] {self.message}"


class ChromeNotRunningError(ChatGPTExtensionError):
    """Chrome process is not running"""

    def __init__(self, message="Chrome is not running"):
        super().__init__(message, "chrome_not_running", is_recoverable=True)


class ChromeLaunchError(ChatGPTExtensionError):
    """Failed to launch Chrome"""

    def __init__(self, message="Failed to launch Chrome"):
        super().__init__(message, "chrome_launch_failed", is_recoverable=False)


class ChromeNotInstalledError(ChatGPTExtensionError):
    """Chrome is not installed on system"""

    def __init__(self, message="Chrome not found. Please install Google Chrome."):
        super().__init__(message, "chrome_not_installed", is_recoverable=False)


class ServerConnectionError(ChatGPTExtensionError):
    """Cannot connect to server"""

    def __init__(self, message="Could not connect to server"):
        super().__init__(message, "server_not_running", is_recoverable=True)


class ExtensionNotConnectedError(ChatGPTExtensionError):
    """Extension not connected to server"""

    def __init__(self, message="Extension not connected to server"):
        super().__init__(message, "extension_not_connected", is_recoverable=True)


class ChatGPTTabMissingError(ChatGPTExtensionError):
    """ChatGPT tab not found"""

    def __init__(self, message="ChatGPT tab not found"):
        super().__init__(message, "chatgpt_tab_missing", is_recoverable=True)


class TabNotVisibleError(ChatGPTExtensionError):
    """ChatGPT tab is not visible/focused"""

    def __init__(self, message="ChatGPT tab not visible"):
        super().__init__(message, "tab_not_visible", is_recoverable=True)


class ElementNotFoundError(ChatGPTExtensionError):
    """DOM element not found"""

    def __init__(self, message="Required UI element not found"):
        super().__init__(message, "element_not_found", is_recoverable=True)


class InjectionFailedError(ChatGPTExtensionError):
    """Message injection failed"""

    def __init__(self, message="Failed to inject message"):
        super().__init__(message, "injection_failed", is_recoverable=True)


class ResponseTimeoutError(ChatGPTExtensionError):
    """ChatGPT took too long to respond"""

    def __init__(self, message="ChatGPT response timeout", timeout_seconds=120):
        msg = f"{message} (waited {timeout_seconds}s)"
        super().__init__(msg, "response_timeout", is_recoverable=True)


class NetworkError(ChatGPTExtensionError):
    """Network communication error"""

    def __init__(self, message="Network communication error"):
        super().__init__(message, "network_error", is_recoverable=True)


# Error categorization and user-friendly messages
ERROR_MESSAGES = {
    "chrome_not_running": {
        "title": "Chrome is not running",
        "description": "The Google Chrome browser is not running.",
        "recovery": "Chrome will be automatically launched. Please try again.",
        "action": "AUTO_LAUNCH_CHROME",
    },
    "chrome_not_installed": {
        "title": "Chrome not found",
        "description": "Google Chrome is not installed on this system.",
        "recovery": "Please install Google Chrome from https://www.google.com/chrome/",
        "action": "MANUAL_INSTALL",
    },
    "server_not_running": {
        "title": "Server not running",
        "description": "The ChatGPT WebSocket server is not running.",
        "recovery": "Make sure the ChatGPTServer Windows service is running.",
        "action": "START_SERVICE",
    },
    "extension_not_connected": {
        "title": "Extension not connected",
        "description": "The Chrome extension is not connected to the server.",
        "recovery": "Please reload the extension or restart Chrome.",
        "action": "RELOAD_EXTENSION",
    },
    "chatgpt_tab_missing": {
        "title": "ChatGPT tab not found",
        "description": "The ChatGPT tab was not found in Chrome.",
        "recovery": "A new ChatGPT tab will be created automatically.",
        "action": "CREATE_TAB",
    },
    "tab_not_visible": {
        "title": "ChatGPT tab not visible",
        "description": "The ChatGPT tab is in the background or minimized.",
        "recovery": "The tab will be brought to the foreground.",
        "action": "FOCUS_TAB",
    },
    "element_not_found": {
        "title": "UI element not found",
        "description": "Required UI elements (textarea or send button) were not found.",
        "recovery": "This may be a temporary issue. The system will retry automatically.",
        "action": "RETRY",
    },
    "injection_failed": {"title": "Injection failed", "description": "Failed to inject the message into ChatGPT.", "recovery": "Try again or reload the ChatGPT page.", "action": "RETRY_OR_RELOAD"},
    "response_timeout": {"title": "ChatGPT response timeout", "description": "ChatGPT took too long to respond.", "recovery": "Please try again with a shorter prompt.", "action": "RETRY"},
    "network_error": {"title": "Network error", "description": "Network communication error occurred.", "recovery": "Please check your connection and try again.", "action": "RETRY"},
}


def get_error_message(error_type):
    """Get user-friendly error message"""
    return ERROR_MESSAGES.get(error_type, {"title": "Unknown error", "description": "An unknown error occurred.", "recovery": "Please try again.", "action": "RETRY"})


def categorize_error(error_message):
    """Categorize error based on message"""
    error_lower = error_message.lower()

    if "chrome" in error_lower and "not found" in error_lower:
        return "chrome_not_installed"
    elif "chrome" in error_lower and ("not running" in error_lower or "failed" in error_lower):
        return "chrome_not_running"
    elif "connection refused" in error_lower or "server" in error_lower:
        return "server_not_running"
    elif "extension" in error_lower and "not connected" in error_lower:
        return "extension_not_connected"
    elif "tab" in error_lower and ("missing" in error_lower or "not found" in error_lower):
        return "chatgpt_tab_missing"
    elif "tab" in error_lower and ("visible" in error_lower or "background" in error_lower):
        return "tab_not_visible"
    elif "element" in error_lower and "not found" in error_lower:
        return "element_not_found"
    elif "injection" in error_lower and "failed" in error_lower:
        return "injection_failed"
    elif "timeout" in error_lower:
        return "response_timeout"
    elif "network" in error_lower or "connection" in error_lower:
        return "network_error"

    return "unknown"


class RetryStrategy:
    """Retry strategy for transient errors"""

    def __init__(self, max_attempts=3, base_delay=1.0, backoff=1.5):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.backoff = backoff

    def should_retry(self, error_type, attempt_count):
        """Determine if should retry"""
        # Transient errors that can be retried
        retriable_errors = {"response_timeout", "network_error", "element_not_found", "injection_failed", "extension_not_connected", "server_not_running"}

        return error_type in retriable_errors and attempt_count < self.max_attempts

    def get_delay(self, attempt_count):
        """Get delay before next attempt (exponential backoff)"""
        return self.base_delay * (self.backoff**attempt_count)


def format_error_for_user(error):
    """Format error message for CLI output"""
    if isinstance(error, ChatGPTExtensionError):
        info = get_error_message(error.error_type)
        return f"""
ERROR: {info['title']}
{info['description']}
Recovery: {info['recovery']}
"""
    else:
        return f"ERROR: {str(error)}"
