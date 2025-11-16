// /**
//  * Base LLM Provider - Abstract class for all LLM provider implementations
//  * Defines the interface that all providers must implement
//  */

'use strict';

class BaseLLMProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.isInitialized = false;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.rateLimit = { minDelayMs: config.minDelayMs || 1000 };
    this.logger = config.logger || console;
  }


  async initialize() {
    throw new Error(`initialize() must be implemented by ${this.name}`);
  }

  async generateContent(prompt, options = {}) {
    throw new Error(`generateContent() must be implemented by ${this.name}`);
  }

  async applyRateLimit() {
    const now = Date.now();
    const wait = this.rateLimit.minDelayMs - (now - this.lastRequestTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') throw new Error('Invalid prompt');
    return true;
  }

  validateResponse(response) {
    if (!response || typeof response !== 'string') throw new Error('Invalid response');
    return response.trim();
  }

  logRequest(prompt, response, duration, metadata = {}) {
    this.logger.info('LLM request completed', {
      provider: this.name,
      promptLength: prompt.length,
      responseLength: response.length,
      duration,
      requestCount: this.requestCount,
      ...metadata,
    });
  }

  async handleError(error, context = 'unknown') {
    // Try to capture the last HTML from the browser for debugging
    let htmlPath = null;
    try {
      if (this.browserManager && this.browserManager.page) {
        const html = await this.browserManager.page.content();
        const fs = require('fs');
        const path = require('path');
        const artifactDir = path.join(process.cwd(), 'artifacts');
        if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir);
        htmlPath = path.join(artifactDir, `${this.name}_last_error_${Date.now()}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');
        this.logger.error(`Saved last HTML to ${htmlPath}`);
      }
    } catch (htmlErr) {
      this.logger.error('Failed to save last HTML artifact', { error: htmlErr.message });
    }
    const e = new Error(`${this.name} provider error in ${context}: ${error.message}`);
    e.originalError = error;
    if (htmlPath) e.artifactPath = htmlPath;
    return e;
  }

  async cleanup() {
    this.isInitialized = false;
  }
}

module.exports = BaseLLMProvider;
