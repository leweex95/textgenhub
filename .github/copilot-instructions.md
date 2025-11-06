---
applyTo: "**"
---
# YouTube Storyteller Project Repository — Copilot Custom Instructions

## Context
- Python 3.11 project with GitHub Actions workflows.
- Code runs in Linux-based CI environment.
- Copilot must prioritize maintainable, production-ready code over verbosity.

## Copilot Behavioral Rules
- When refining or correcting a GitHub Actions workflow:
  - Automatically redeploy it using the GitHub API.
  - Use a single shell polling loop to monitor job status until completion (no repeated chat-based polling).
  - If workflow fails, automatically fetch the failure reason, fix it, and redeploy iteratively until successful.
- When instructed to “test your solution before getting back to me”:
  - Execute or simulate the change (e.g., via shell command or GitHub Actions) and confirm correctness.
  - Do not generate unit, integration, or mock tests unless explicitly requested.
- Documentation must only be created or updated if explicitly requested.
- Temporary or debug files must be minimized:
  - Only keep files relevant to the current debugging or verification phase.
  - Remove all temporary or test files before presenting final output.
  - Final code must always be clean, complete, and production-ready.
- Emphasize simplicity, maintainability, and directness in all code solutions.

## Code Style
- Follow PEP 8 strictly.
- Use `snake_case` for variables and functions.
- Use `PascalCase` for classes.
- Prefer explicit imports and typing (`from typing import Any, Optional, List, Dict`).
- Include inline comments only when logically necessary for clarity (no verbose explanations).
- Use f-strings for string interpolation.
- Maintain consistent and readable indentation (4 spaces, no tabs).

## Error Handling and Logic
- Never use fallback or dummy inputs unless explicitly required.
- Validate all required arguments and inputs strictly.
- Fail fast and visibly if required parameters are missing or invalid.
- Use `try/except` for error handling; raise meaningful exceptions with descriptive messages.
- Avoid silent failure or suppression of exceptions.

## GitHub Actions and Commits
- Commit messages:
  - Always one line.
  - Start with lowercase letter.
  - Use past tense verbs.
  - Never use prefixes like `feat:` or `fix:`.
- Never use `git add .` or `git add -A`. Always stage specific files. 
- If there is a pre-commit hook blocking the commit, fix the underlying issue instead of bypassing it.
- After successful automated workflow validation, commit and push final results cleanly.
- Avoid committing or leaving behind debug, tmp, cache, or test artifacts (e.g., `__pycache__`, `.pytest_cache`, `.ipynb_checkpoints`).

## General Development Rules
- Always aim for the simplest solution that meets requirements.
- Avoid over-engineering or unnecessary abstractions.
- Emphasize readability and clarity in code.
- Keep functions small and focused on a single task.
- If you change a code to deprecated, make sure to remove it after testing the new solution. There is no need for backward compatibility unless explicitly requested.
- If you change a function, make sure to adapt its test cases as well.
- Always document complex logic with concise comments but avoid over-commenting.
- Prioritize performance only when explicitly required; otherwise, favor clarity.
- Prioritize correct, maintainable, minimal code over verbosity.
- Refactor only when essential to fix a bug or implement a requested change.
- Never generate placeholder, mock, or boilerplate code unless explicitly asked.
- Keep repository clean and consistent after each automated or manual change.
- Always ensure the final output is production-ready and free of temporary artifacts.
- Always be autonomous and proceed iteratively without waiting for further instructions unless absolutely necessary.
