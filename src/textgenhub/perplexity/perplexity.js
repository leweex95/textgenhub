/**
 * Perplexity Provider - Browser automation for Perplexity AI web interface
 */

'use strict';

const path = require('path');
const BaseLLMProvider = require('../core/base-provider');

class PerplexityProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super('perplexity', config);

    this.browserManager = null;
    this.isLoggedIn = false;
    this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hour
    this.lastSessionCheck = 0;

    this.removeCache = config.removeCache !== undefined ? config.removeCache : true;

    // Very specific selectors to avoid email/popup inputs
    this.selectors = {
      textArea: '[class*="QueryInput"], div[contenteditable][role="textbox"]:not([type="email"]):not([placeholder*="email"]):not([class*="footer"]), div[aria-label="Search"] div[contenteditable="true"]',
      submitButton: 'button[type="submit"], button[aria-label*="Ask"], button[aria-label*="Search"]',
      responseContainer: 'div[class*="answer"], div[class*="response"], div[class*="result"]',
    };

    this.urls = {
      chat: 'https://www.perplexity.ai/',
    };

    this.config = {
      headless: config.headless !== undefined ? config.headless : true,
      timeout: config.timeout || 60000,
      sessionTimeout: config.sessionTimeout || 3600000,
      userDataDir: config.userDataDir || path.join(process.cwd(), 'temp', 'perplexity-session'),
      ...config,
    };
  }

  async initialize() {
    try {
      this.logger?.info('Initializing Perplexity provider...');
      const BrowserManager = require('../core/browser-manager');
      const browserConfig = {
        headless: this.config.headless,
        timeout: this.config.timeout,
        userDataDir: this.config.userDataDir,
        debug: this.config.debug,
      };
      this.browserManager = new BrowserManager(browserConfig);
      await this.browserManager.initialize();
      this.logger?.info('Navigating to Perplexity Chat...', { url: this.urls.chat });
      await this.browserManager.navigateToUrl(this.urls.chat);
      // Optionally, check for text area to confirm page load
      try {
        await this.browserManager.page.waitForSelector(this.selectors.textArea, { timeout: 15000 });
        this.logger?.info('Perplexity Chat interface ready.');
      } catch (e) {
        this.logger?.warn('Text area not found after navigation.', { error: e.message });
      }
      this.isInitialized = true;
    } catch (error) {
      throw await this.handleError(error, 'initialization');
    }
  }

  async generateContent(prompt) {
    if (!this.browserManager || !this.browserManager.page) {
      throw await this.handleError(new Error('Browser not initialized'), 'content generation');
    }
    try {
      this.validatePrompt(prompt);
      await this.applyRateLimit();

      const startTime = Date.now();
      if (this.config.debug) this.logger.info('Sending prompt to Perplexity', {
        promptLength: prompt.length,
      });

      // First clear the page state
      try {
        await this.browserManager.page.evaluate(() => {
          // Try to find and click "New Chat" button first
          const newChatBtn = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent?.toLowerCase().includes('new chat') || 
            btn.getAttribute('aria-label')?.toLowerCase().includes('new chat')
          );
          if (newChatBtn) {
            newChatBtn.click();
            return;
          }

          // If no New Chat button, try to clear existing responses
          const main = document.querySelector('main');
          if (main) {
            const responses = main.querySelectorAll('div[class*="answer"], div[class*="response"]');
            responses.forEach(el => el.parentNode?.removeChild(el));
          }
        });
        await this.browserManager.delay(1000);
      } catch (e) {
        if (this.config.debug) this.logger.debug('Error clearing page state', { error: e.message });
      }

      // Handle any popups
      try {
        await this.browserManager.page.evaluate(() => {
          // Click all visible close buttons
          const closeButtons = Array.from(document.querySelectorAll(
            'button[aria-label*="Close"], button[aria-label*="Dismiss"], [class*="close"]'
          )).filter(el => el.offsetParent !== null);
          closeButtons.forEach(btn => btn.click());

          // Remove any remaining popups/dialogs
          const popups = Array.from(document.querySelectorAll(
            'div[role="dialog"], [class*="popup"], [class*="modal"], [class*="overlay"]'
          )).filter(el => el.offsetParent !== null);
          popups.forEach(popup => popup.parentNode?.removeChild(popup));
        });
        await this.browserManager.delay(500);
      } catch (e) {
        if (this.config.debug) this.logger.debug('Error handling popups', { error: e.message });
      }

      // Find and prepare input
      try {
        const inputReady = await this.browserManager.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll(
            'div[class*="SearchBox"] [contenteditable="true"], ' +
            'div[class*="QueryInput"] [contenteditable="true"], ' +
            'main div[contenteditable="true"]'
          )).filter(el => {
            const isVisible = el.offsetParent !== null;
            const notInPopup = !el.closest('div[role="dialog"]') && !el.closest('[class*="popup"]');
            const notEmail = !el.getAttribute('placeholder')?.includes('email');
            return isVisible && notInPopup && notEmail;
          });

          if (inputs.length > 0) {
            inputs[0].innerHTML = '';
            inputs[0].focus();
            return true;
          }
          return false;
        });

        if (!inputReady) {
          throw new Error('Could not find appropriate input field');
        }

        // Type the prompt
        await this.browserManager.page.keyboard.type(prompt);
        if (this.config.debug) this.logger.debug('Prompt typed successfully');
        
        // Submit the prompt
        await this.browserManager.page.keyboard.press('Enter');
        
        // Wait for response
        const response = await this.waitForResponse();
        
        const duration = Date.now() - startTime;
        this.logRequest(prompt, response, duration);

        return response;
      } catch (error) {
        this.logger.error('Failed to generate content', { error: error.message });
        throw await this.handleError(error, 'content generation');
      }
    } catch (error) {
      this.logger.error('Error in generateContent', { error: error.message });
      throw await this.handleError(error, 'content generation');
    }
  // removed stray closing brace after generateContent
  }

  async waitForResponse(timeout = 60000) {
    const startTime = Date.now();
    let response = '';

    while (Date.now() - startTime < timeout) {
      try {
        response = await this.browserManager.page.evaluate(() => {
          console.log('Checking for response elements...');
          const allDivs = document.querySelectorAll('div');
          console.log('Total divs found:', allDivs.length);
          
          const responseDivs = Array.from(document.querySelectorAll(
            // Selectors for finding responses in the DOM
            'div[class*="CopyableOutputText"], ' + // Primary answer text 
            'div[data-testid="answer-text"], ' + // Secondary answer test container
            'div[class*="answer-text"], ' + // Generic answer containers
            'div[class*="perplexity-answer"], ' + // Branded answer containers
            'div[class*="prose"] > p' // Markdown-rendered responses
          )).filter(el => {
            const isVisible = el.offsetParent !== null;
            const hasContent = el.textContent.trim().length > 0;
            const notInput = !el.getAttribute('contenteditable');
            return isVisible && hasContent && notInput;
          });

          console.log('Found response divs:', responseDivs.length);
          
          if (responseDivs.length > 0) {
            // Get the last visible response
            const lastResponse = responseDivs[responseDivs.length - 1];
            console.log('Response element classes:', lastResponse.className);
            return lastResponse.textContent.trim();
          }

          return '';
        });

        if (response.length > 0) {
          const cleanedResponse = this.cleanResponse(response);
          
          // Validate extracted response - if it looks suspicious, save HTML for debugging
          if (cleanedResponse && (
            cleanedResponse.length < 2 ||
            (cleanedResponse.length > 200 && cleanedResponse.includes('Answer with only'))
          )) {
            this.logger.warn('Extracted response looks suspicious, saving HTML artifact for debugging', {
              responseLength: cleanedResponse.length,
              responsePreview: cleanedResponse.substring(0, 100),
            });
            
            try {
              const html = await this.browserManager.page.content();
              const fs = require('fs');
              const path = require('path');
              const artifactDir = path.join(process.cwd(), 'artifacts');
              if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
              const htmlPath = path.join(artifactDir, `perplexity_suspicious_response_${Date.now()}.html`);
              fs.writeFileSync(htmlPath, html, 'utf8');
              this.logger.error(`Saved HTML artifact due to suspicious response: ${htmlPath}`);
            } catch (htmlErr) {
              this.logger.error('Failed to save HTML artifact', { error: htmlErr.message });
            }
          }
          
          return cleanedResponse;
        }

        await this.browserManager.delay(1000);
      } catch (e) {
        console.error('Error while waiting for response:', e);
        await this.browserManager.delay(1000);
      }
    }

    throw new Error('Timeout waiting for response');
  }

  cleanResponse(text) {
    return text
      .replace(/Copy|Share|Export|Related/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async cleanup() {
    if (this.browserManager) {
      if (this.removeCache) {
        await this.browserManager.cleanupCache();
      }
      await this.browserManager.close();
      this.browserManager = null;
    }
    this.isInitialized = false;
  }

  async isHealthy() {
    try {
      if (!this.browserManager?.page) return false;
      const inputVisible = await this.browserManager.page.$(this.selectors.textArea);
      return !!inputVisible;
    } catch (error) {
      return false;
    }
  }
}

module.exports = PerplexityProvider;