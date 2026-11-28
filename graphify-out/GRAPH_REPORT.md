# Graph Report - textgenhub  (2026-06-21)

## Corpus Check
- 78 files · ~43,937 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 828 nodes · 1008 edges · 85 communities (68 shown, 17 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f449c124`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 67|Community 67]]

## God Nodes (most connected - your core abstractions)
1. `SimpleProvider` - 94 edges
2. `run_provider_old()` - 31 edges
3. `TestChatGPTAskFunction` - 18 edges
4. `TestCodeBlockExtraction` - 18 edges
5. `GrokProvider` - 17 edges
6. `GrokProvider` - 17 edges
7. `BaseLLMProvider` - 16 edges
8. `DeepSeekProvider` - 15 edges
9. `DeepSeekProvider` - 15 edges
10. `TestSimpleProviderAsk` - 11 edges

## Surprising Connections (you probably didn't know these)
- `test_class_chat_delegates()` --calls--> `DeepSeekAPI`  [INFERRED]
  tests/api/deepseek/test_deepseek.py → src/textgenhub/api/deepseek/deepseek.py
- `_make_provider()` --calls--> `Path`  [INFERRED]
  tests/core/test_provider.py → src/textgenhub/cli.py
- `_make_provider()` --calls--> `SimpleProvider`  [INFERRED]
  tests/core/test_provider.py → src/textgenhub/core/provider.py
- `TestSimpleProviderCommandBuilding` --uses--> `SimpleProvider`  [INFERRED]
  tests/test_core_provider.py → src/textgenhub/core/provider.py
- `TestSimpleProviderErrors` --uses--> `SimpleProvider`  [INFERRED]
  tests/test_core_provider.py → src/textgenhub/core/provider.py

## Import Cycles
- 1-file cycle: `src/textgenhub/__init__.py -> src/textgenhub/__init__.py`
- 1-file cycle: `src/textgenhub/webui/__init__.py -> src/textgenhub/webui/__init__.py`

## Communities (85 total, 17 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (26): Comprehensive tests for ChatGPT module (new session-based implementation), Test the ChatGPT class, Test ChatGPT class can be instantiated, Test ChatGPT.chat() method, Test ChatGPT.chat() can be called multiple times, Test ChatGPT.chat() with special characters, Test error handling in ChatGPT ask function, Test ask() when subprocess stdout is None (+18 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (27): Simple base provider for all text generation services. No overengineering, just, Send a prompt to the provider and get a response.          Args:, Send a prompt to DeepSeek and get a response.      Args:         prompt (str): T, Send a prompt to DeepSeek and get a response.      Args:         prompt (str): T, Send a prompt to Grok and get a response.      Args:         prompt (str): Th, Send a prompt to Grok and get a response.      Args:         prompt (str): Th, Send a prompt to Perplexity and get a response.      Args:         prompt (st, Send a prompt to Perplexity and get a response.      Args:         prompt (st (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (18): Test the ask() function in chatgpt module, Test that headless parameter is ignored for session-based CLI, Test that remove_cache parameter is ignored for session-based CLI, Test ask() with all parameters specified, Test basic ask() function with simple prompt, Test ask() with empty prompt, Test ask() with special characters in prompt, Test ask() with unicode characters (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (18): Test code block extraction and response cleaning functionality, Test that JSON code blocks are extracted cleanly without UI artifacts, Test that bash code blocks are extracted cleanly, Test that Python code blocks are extracted cleanly, Test that HTML code blocks are extracted cleanly, Test that CSS code blocks are extracted cleanly, Test that JavaScript code blocks are extracted cleanly, Test that SQL code blocks are extracted cleanly (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (23): ChatGPT, ChatGPT, CLI examples, CLI Options, DeepSeek, DeepSeek, Development Notes, HTML Output Format (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (3): BaseLLMProvider, Path, _get_default_chatgpt_user_data_dir()

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (12): Simple base class for all text generation providers, SimpleProvider, Test ask with headless=False, Test all boolean flag combinations, Test SimpleProvider.ask() method with various inputs, Test basic prompt handling, Test empty prompt handling, Test very long prompt (5000+ characters) (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): devDependencies, mocha, files, author, dependencies, fs-extra, puppeteer, puppeteer-extra (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (10): Test ChatGPT command without debug flag when debug=False, Test ChatGPT command with custom timeout, Test ChatGPT command with typing speed, Test ChatGPT command without typing speed flag when typing_speed=None, Test command building specifically for ChatGPT (session-based) provider, Test ChatGPT command building with just prompt, Test ChatGPT command does NOT include --headless flag, Test ChatGPT command does NOT include --remove-cache flag (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (11): ask(), list_models(), Ollama, Ollama provider - locally-hosted LLM via Ollama REST API., Send a prompt to a local Ollama instance and return the response., Ollama provider class., Send a chat prompt and return the response., List available Ollama models. Returns empty list on failure. (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (16): author, dependencies, fs-extra, puppeteer, puppeteer-extra, puppeteer-extra-plugin-stealth, yargs, description (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (10): API-key-based proivders. Each sub-module calls the provider's official REST API, DeepSeekAPI, Send a prompt to DeepSeek API and return the response., DeepSeek API provider class., Send a chat prompt and return the response., mock_post(), test_ask_behavior(), test_class_chat_delegates() (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (10): Test various response content types, Test response containing HTML tags, Test response with special characters, Test response with unicode characters, Test response with newline characters, Test very long response (10000+ characters), Test empty response content, TestRunProviderOldResponseTypes (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (9): Test ChatGPT module import, Test DeepSeek module import, Test Perplexity module import, Test Grok module import, Test CLI module import, Test core provider import, Test utilities import, Test that all critical modules can be imported (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (9): Test command building for legacy providers (DeepSeek, Perplexity, Grok), Test legacy providers include --headless flag, Test legacy providers with headless=False, Test legacy providers include --remove-cache flag, Test legacy providers with remove_cache=False, Test legacy providers include debug flag with value, Test legacy providers exclude debug flag when debug=False, Test legacy providers with typing speed (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (11): __dirname, enforceSingleChatPage(), extractConversationFromUrl(), __filename, getCentralSessionsDir(), getSessionsFilePath(), isChatGPTDomain(), loadSessions() (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (11): __dirname, enforceSingleChatPage(), extractConversationFromUrl(), __filename, getCentralSessionsDir(), getSessionsFilePath(), isChatGPTDomain(), loadSessions() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (9): Test basic initialization with provider name and script, Test initialization with various provider names, Test command building in SimpleProvider, Test command structure and argument order, Test debug flag is included when debug=True, Test debug flag is not included when debug=False, Test SimpleProvider initialization, TestSimpleProviderCommandBuilding (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (12): Available Models, ChatGPT, ChatGPT Sessions, DeepSeek API, Node.js Providers, Ollama, Ollama.chat() Parameters, Ollama Configuration (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (8): __dirname, __filename, getDefaultUserDataDir(), getSessionsFilePath(), isPortActive(), loadSessions(), pickAvailablePort(), saveSessions()

### Community 24 - "Community 24"
Cohesion: 0.21
Nodes (8): __dirname, __filename, getDefaultUserDataDir(), getSessionsFilePath(), isPortActive(), loadSessions(), pickAvailablePort(), saveSessions()

### Community 25 - "Community 25"
Cohesion: 0.17
Nodes (11): All Options, ChatGPT, CLI Reference, DeepSeek API, Examples, HTML / Raw, JSON (default), Ollama (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (11): Adding a New Provider, CI, Dev Tools, Development, Graphify, Package.json, Ponytail (AGENTS.md), Pre-commit Hooks (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (7): Test routing to chatgpt provider, Test routing to deepseek provider, Test routing to perplexity provider, Test routing to grok provider, Test unknown provider raises error, Test provider routing in run_provider_old, TestRunProviderOldProviders

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (7): Test prompt handling variations, Test empty prompt handling, Test very long prompt (10000+ characters), Test prompt with newline characters, Test prompt with quotes and escape characters, Test prompt with JSON-like characters, TestRunProviderOldPrompts

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (7): Test SimpleProvider error handling, Test subprocess stdout is None, Test no JSON response in output, Test UTF-8 decode error with replacement, Test empty response value in JSON, Test output with multiple JSON lines - uses last one, TestSimpleProviderErrors

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (7): Test pyproject.toml exists, Test package.json exists in root, Test package.json exists in src/textgenhub, Test configuration file existence and format, Test pytest.ini exists, Test .pre-commit-config.yaml exists, TestConfigurationFiles

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (7): Test SimpleProvider initialization and configuration, Test initialization for ChatGPT provider, Test initialization for DeepSeek provider, Test initialization for Perplexity provider, Test initialization for Grok provider, Test CLI script path is resolved relative to provider directory, TestSimpleProviderInitialization

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (7): Test subprocess execution and output handling, Test subprocess runs in correct working directory, Test subprocess stdout and stderr are piped, Test subprocess.wait() is called, Test parsing multiline subprocess output, Test multiple JSON lines uses the last one, TestSimpleProviderSubprocessHandling

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (7): ask(), close(), ChatGPT provider (new) - thin wrapper over chatgpt-session CLI, Send a prompt to ChatGPT and get a response using the new session-based module., Close the browser session for ChatGPT.      Args:         session (int | None):, ChatGPT, ChatGPT provider class

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (9): _bootstrap_sessions_json(), categorize_error(), _get_central_sessions_dir(), get_error_message(), _get_sessions_file_path(), log_error(), main(), Categorize error based on error message content (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (6): Test JSON output format (default), Test HTML output format, Test raw text output format, Test that format flag is passed to subprocess, Test output format handling, TestRunProviderOldOutputFormats

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (6): Test error handling in run_provider_old, Test subprocess error handling, Test invalid JSON in response, Test missing response field in JSON, Test empty response from subprocess, TestRunProviderOldErrorHandling

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (6): Test project structure integrity, Test logs directory for artifacts, Test src directory structure, Test artifacts directory not in root, Test temp directory not in root, TestFileSystemStructure

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (6): Test timeout parameter handling, Test default timeout value is 120, Test small custom timeout, Test large custom timeout, Test timeout is converted to string in command, TestSimpleProviderTimeoutHandling

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (6): Test error scenarios and exception handling, Test RuntimeError when subprocess stdout is None, Test RuntimeError when no JSON response in output, Test UnicodeDecodeError is handled gracefully, Test empty subprocess output raises error, TestSimpleProviderErrorHandling

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (8): ensure_chrome_running(), find_chrome_executable(), is_chrome_running(), launch_chrome(), Find Chrome executable on Windows, Check if Chrome process is currently running, Launch Chrome if not already running, Ensure Chrome is running, launch if needed

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (7): Code Style, Context, Copilot Behavioral Rules, Error Handling and Logic, General Development Rules, GitHub Actions and Commits, YouTube Storyteller Project Repository — Copilot Custom Instructions

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (5): Test README contains critical information, Test README.md exists, Test README documents ChatGPT providers, Test README has CLI examples, TestREADMEDocumentation

### Community 45 - "Community 45"
Cohesion: 0.25
Nodes (5): Extended comprehensive tests for SimpleProvider core module Tests command build, Test realistic integration scenarios, Test all parameters work together correctly, Test multiple sequential calls to same provider, TestSimpleProviderIntegration

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (5): Test JSON response parsing, Test response with empty string value, Test response containing JSON special characters, Test response containing newlines, TestSimpleProviderResponseParsing

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (6): ChatGPT, DeepSeek, Grok, Node.js Usage, Perplexity, Quick Start

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): BaseProvider, BrowserManager, ChatGPT, DeepSeek, Grok, Perplexity

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (4): Test boolean flag handling, Test headless flag when True, Test headless flag when False, TestRunProviderOldFlags

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (4): Test integration and configuration, Test index.js exports, Test that index.js exports correct modules, TestIndexJsExports

### Community 52 - "Community 52"
Cohesion: 0.80
Nodes (4): _make_provider(), mock_popen(), test_ask_success_and_errors(), test_provider_cli_flags()

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (4): CLI Commands, Recovering Sessions, Session Management (ChatGPT), Session Storage

### Community 55 - "Community 55"
Cohesion: 0.40
Nodes (3): Test Python environment, Test Python executable exists, TestPythonVersion

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): pytest_configure(), Pytest configuration and fixtures for textgenhub tests., Register custom pytest markers.

## Knowledge Gaps
- **99 isolated node(s):** `ChatGPT`, `DeepSeek`, `Perplexity`, `Grok`, `BaseProvider` (+94 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SimpleProvider` connect `Community 6` to `Community 1`, `Community 5`, `Community 8`, `Community 15`, `Community 16`, `Community 21`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 37`, `Community 38`, `Community 39`, `Community 44`, `Community 45`, `Community 46`, `Community 51`, `Community 52`, `Community 55`?**
  _High betweenness centrality (0.247) - this node is a cross-community bridge._
- **Why does `Path` connect `Community 5` to `Community 1`, `Community 34`, `Community 65`, `Community 42`, `Community 14`, `Community 17`, `Community 19`, `Community 52`, `Community 23`, `Community 24`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `run_provider_old()` connect `Community 14` to `Community 1`, `Community 34`, `Community 35`, `Community 36`, `Community 5`, `Community 50`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Are the 78 inferred relationships involving `SimpleProvider` (e.g. with `_make_provider()` and `ask()`) actually correct?**
  _`SimpleProvider` has 78 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `Path` (e.g. with `.__init__()` and `_make_provider()`) actually correct?**
  _`Path` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ChatGPT`, `DeepSeek`, `Perplexity` to the rest of the system?**
  _330 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._