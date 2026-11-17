# Changelog

## 2.0.2

- Update Puppeteer and lockfiles to clear high-severity runtime npm advisories.
- Keep browser-session integration checks manual so pull requests do not queue on an unavailable self-hosted runner.

## 1.2.3

- Support scraping assistant responses from ChatGPT's current accessible conversation-turn markup when the legacy thread container and `<article>` elements are absent.
- Detect the current contenteditable composer consistently during the login/session health check.
- Add local DOM regression tests for response extraction and stale-response rejection.
