#!/usr/bin/env python3
"""
Structured logging for ChatGPT extension CLI
"""
import json
import sys
from datetime import datetime
from pathlib import Path


class StructuredLogger:
    """Structured logging for ChatGPT extension CLI"""

    def __init__(self, export_path=None):
        self.logs = []
        self.export_path = export_path
        self.session_id = datetime.utcnow().isoformat()

    def log(self, level, message, **context):
        """Log structured message"""
        entry = {"timestamp": datetime.utcnow().isoformat(), "level": level, "message": message, "context": context}
        self.logs.append(entry)

        # Print to stderr (doesn't interfere with JSON output)
        self._print_to_stderr(entry)

    def _print_to_stderr(self, entry):
        """Print log entry to stderr"""
        level = entry["level"]
        msg = entry["message"]

        # Color coding for terminal (if supported)
        colors = {"INFO": "\033[94m", "WARNING": "\033[93m", "ERROR": "\033[91m", "DEBUG": "\033[90m", "RESET": "\033[0m"}  # Blue  # Yellow  # Red  # Gray

        color = colors.get(level, "")
        reset = colors["RESET"]

        # Check if terminal supports colors
        if not hasattr(sys.stderr, "isatty") or not sys.stderr.isatty():
            color = reset = ""

        timestamp = entry["timestamp"].split("T")[1].split(".")[0]
        print(f"{color}[{level}] {timestamp} {msg}{reset}", file=sys.stderr)

    def info(self, message, **context):
        """Log info level"""
        self.log("INFO", message, **context)

    def warning(self, message, **context):
        """Log warning level"""
        self.log("WARNING", message, **context)

    def error(self, message, **context):
        """Log error level"""
        self.log("ERROR", message, **context)

    def debug(self, message, **context):
        """Log debug level"""
        self.log("DEBUG", message, **context)

    def export(self, filepath=None):
        """Export logs to file"""
        export_path = filepath or self.export_path

        if not export_path:
            return False

        try:
            path = Path(export_path)
            path.parent.mkdir(parents=True, exist_ok=True)

            with open(path, "w") as f:
                json.dump({"session_id": self.session_id, "exported_at": datetime.utcnow().isoformat(), "log_count": len(self.logs), "logs": self.logs}, f, indent=2)

            self.info(f"Logs exported to {export_path}")
            return True
        except Exception as e:
            self.error(f"Failed to export logs: {e}")
            return False

    def get_summary(self):
        """Get summary of logs"""
        by_level = {}
        for log in self.logs:
            level = log["level"]
            by_level[level] = by_level.get(level, 0) + 1

        return {"total": len(self.logs), "by_level": by_level, "session_id": self.session_id, "duration": (self.logs[-1]["timestamp"] if self.logs else self.session_id)}


# Global logger instance
_logger = None


def get_logger(export_path=None):
    """Get global logger instance"""
    global _logger
    if _logger is None:
        _logger = StructuredLogger(export_path)
    return _logger


def log_info(message, **context):
    """Log info message"""
    get_logger().info(message, **context)


def log_warning(message, **context):
    """Log warning message"""
    get_logger().warning(message, **context)


def log_error(message, **context):
    """Log error message"""
    get_logger().error(message, **context)


def log_debug(message, **context):
    """Log debug message"""
    get_logger().debug(message, **context)


def export_logs(filepath=None):
    """Export logs to file"""
    return get_logger().export(filepath)


def get_log_summary():
    """Get log summary"""
    return get_logger().get_summary()
