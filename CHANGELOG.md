# Changelog

## 1.2.3

- Support scraping assistant responses from ChatGPT's current accessible conversation-turn markup when the legacy thread container and `<article>` elements are absent.
- Detect the current contenteditable composer consistently during the login/session health check.
- Add local DOM regression tests for response extraction and stale-response rejection.
