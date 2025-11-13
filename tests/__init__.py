"""
TextGenHub Test Suite - Production-ready unit tests with full mocking
No browser or API interaction. Tests input variations, error handling, output validation.
Run with: poetry run pytest tests/ -v
"""

import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
