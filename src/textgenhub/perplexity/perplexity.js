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
      textArea: 'div[contenteditable="true"]:not([type="email"]):not([placeholder*="email"]):not([class*="footer"]), textarea:not([type="email"]), input[type="text"]:not([type="email"])',
      submitButton: 'button[type="submit"], button[aria-label*="Ask"], button[aria-label*="Search"], button[aria-label*="Send"]',
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

      // Wait for the page to fully load, handling Cloudflare challenges
      await this.waitForInterfaceReady();

      this.isInitialized = true;
      this.logger?.info('Perplexity provider initialized successfully');
    } catch (error) {
      throw await this.handleError(error, 'initialization');
    }
  }

  /**
   * Wait for Perplexity interface to be ready, handling Cloudflare challenges
   */
  async waitForInterfaceReady() {
    const maxWaitTime = 60000; // 60 seconds to handle Cloudflare
    const checkInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();

    this.logger?.info('Waiting for Perplexity interface to load...');

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check if we're still on a Cloudflare challenge page
        const isCloudflareChallenge = await this.browserManager.page.evaluate(() => {
          const title = document.title.toLowerCase();
          const bodyText = document.body?.textContent?.toLowerCase() || '';
          return title.includes('just a moment') ||
                 bodyText.includes('verifying you are human') ||
                 bodyText.includes('checking your browser');
        });

        if (isCloudflareChallenge) {
          this.logger?.debug('Cloudflare challenge detected, waiting...');
          await this.browserManager.delay(checkInterval);
          continue;
        }

        // Check if the actual Perplexity interface has loaded
        const interfaceReady = await this.browserManager.page.evaluate(() => {
          // Look for Perplexity-specific elements that indicate the interface is loaded
          const hasPerplexityElements = !!(
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea') ||
            document.querySelector('input[type="text"]') ||
            document.querySelector('[class*="perplexity"]') ||
            document.querySelector('[data-testid*="perplexity"]')
          );

          // Also check that we're on the correct domain
          const isCorrectDomain = window.location.hostname === 'www.perplexity.ai';

          return hasPerplexityElements && isCorrectDomain;
        });

        if (interfaceReady) {
          // Double-check by trying to find the input field
          try {
            await this.browserManager.page.waitForSelector(
              'div[contenteditable="true"], textarea, input[type="text"]',
              { timeout: 5000 }
            );
            this.logger?.info('Perplexity interface ready');
            return;
          } catch (e) {
            this.logger?.debug('Interface elements found but input not ready yet');
          }
        }

        await this.browserManager.delay(checkInterval);
      } catch (e) {
        this.logger?.debug('Error checking interface readiness', { error: e.message });
        await this.browserManager.delay(checkInterval);
      }
    }

    throw new Error('Timeout waiting for Perplexity interface to load');
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
          // Look for various input types
          const possibleInputs = [
            // Contenteditable divs
            ...Array.from(document.querySelectorAll('div[contenteditable="true"]')),
            // Textareas
            ...Array.from(document.querySelectorAll('textarea')),
            // Text inputs
            ...Array.from(document.querySelectorAll('input[type="text"]')),
          ].filter(el => {
            const isVisible = el.offsetParent !== null;
            const notInPopup = !el.closest('div[role="dialog"]') && !el.closest('[class*="popup"]') && !el.closest('[class*="modal"]');
            const notEmail = !el.getAttribute('placeholder')?.toLowerCase().includes('email') && 
                           !el.getAttribute('type')?.includes('email') &&
                           !el.className?.toLowerCase().includes('email');
            const notHidden = !el.getAttribute('hidden') && el.style.display !== 'none' && el.style.visibility !== 'hidden';
            return isVisible && notInPopup && notEmail && notHidden;
          });

          if (possibleInputs.length > 0) {
            // Prefer the first visible input
            const input = possibleInputs[0];
            if (input.tagName.toLowerCase() === 'div' && input.getAttribute('contenteditable') === 'true') {
              input.innerHTML = '';
              input.focus();
            } else {
              input.value = '';
              input.focus();
            }
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
        
        // Submit the prompt - try multiple methods
        let submitted = false;
        try {
          // Try Enter key first
          await this.browserManager.page.keyboard.press('Enter');
          submitted = true;
          if (this.config.debug) this.logger.debug('Submitted with Enter key');
        } catch (e) {
          if (this.config.debug) this.logger.debug('Enter key failed, trying button click');
        }
        
        if (!submitted) {
          // Try clicking submit button
          try {
            await this.browserManager.page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const text = btn.textContent?.toLowerCase() || '';
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                return text.includes('ask') || text.includes('search') || text.includes('send') ||
                       ariaLabel.includes('ask') || ariaLabel.includes('search') || ariaLabel.includes('send') ||
                       btn.getAttribute('type') === 'submit';
              });
              if (buttons.length > 0) {
                buttons[0].click();
                return true;
              }
              return false;
            });
            submitted = true;
            if (this.config.debug) this.logger.debug('Submitted with button click');
          } catch (e) {
            if (this.config.debug) this.logger.debug('Button click failed');
          }
        }
        
        if (!submitted) {
          throw new Error('Could not submit the prompt');
        }
        
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