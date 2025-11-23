/**
 * Grok Provider - Browser automation for Grok web interface
 * Uses Puppeteer to interact with Grok when API access is not available
 *
 * IMPORTANT: This provider uses NON-HEADLESS mode (headless=false).
 *
 * Reason: Grok.com is a complex React SPA that doesn't properly render
 * response content to the DOM when running in Puppeteer's headless mode.
 * The assistant message element exists but remains empty, making extraction impossible.
 *
 * The browser window is automatically minimized via Chrome DevTools Protocol
 * to prevent interference with laptop usability during CI/automated execution.
 * This approach ensures responses are properly rendered while maintaining
 * a non-intrusive automated testing experience.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const BaseLLMProvider = require('../core/base-provider');
const BrowserManager = require('../core/browser-manager');

class GrokProvider extends BaseLLMProvider {

  /**
   * Save current HTML page as artifact for debugging
   * @param {string} reason - Reason for saving artifact
   */
  async saveHtmlArtifact(reason = 'manual') {
    try {
      if (this.browserManager && this.browserManager.page) {
        const html = await this.browserManager.page.content();
        const fs = require('fs');
        const path = require('path');
        const artifactDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
        const htmlPath = path.join(artifactDir, `grok_manual_${reason}_${Date.now()}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');
        this.logger.error(`Saved manual HTML artifact: ${htmlPath}`);
        return htmlPath;
      }
    } catch (err) {
      this.logger.error('Failed to save manual HTML artifact', { error: err.message });
    }
    return null;
  }
  constructor(config = {}) {
    super('grok', config);

  this.browserManager = null;
  this.isLoggedIn = false;
  this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hour
  this.lastSessionCheck = 0;

  // Force debug mode for investigation
  this.config.debug = true;

  this.removeCache = config.removeCache !== undefined ? config.removeCache : true;
  this.continuous = config.continuous !== undefined ? config.continuous : false;

    // Grok-specific selectors (may need updates as UI changes)
    this.selectors = {
      loginButton: '[data-testid="login-button"]',
      emailInput: '#username',
      passwordInput: '#password',
      submitButton: 'button[type="submit"]',
      textArea:
        'textarea, input[type="text"], [contenteditable="true"], [role="textbox"], [data-testid*="input"], [data-testid*="composer"], #prompt-textarea, textarea[placeholder*="Ask"], textarea[placeholder*="Message"], [data-testid="composer-text-input"]',
      sendButton:
        'button[type="submit"], button[aria-label*="Send"], button[data-testid*="send"], [data-testid="send-button"], button[aria-label*="Submit"], button[class*="send"], svg[aria-label*="Send"]',
      messageContainer:
        '[data-testid*="conversation-turn"], [data-testid="conversation-turn"], .group, .flex.flex-col, div[class*="conversation"]',
      responseText:
        '[data-testid*="conversation-turn"] .markdown, [data-testid*="conversation-turn"] div[class*="markdown"], .prose, div[class*="prose"], .whitespace-pre-wrap',
      regenerateButton:
        '[data-testid="regenerate-button"], button[aria-label*="Regenerate"]',
      ...config.selectors,
    };

    this.urls = {
      login: 'https://grok.com/auth/login',
      chat: 'https://grok.com/',
      ...config.urls,
    };

    // Grok-specific configuration with configurable headless mode
    this.config.headless =
      config.headless !== undefined ? config.headless : false; // Default to non-headless for Grok
    this.config.timeout = config.timeout || 60000;
    this.config.sessionTimeout = config.sessionTimeout || 3600000;
    this.config.userDataDir =
      this.config.userDataDir || path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
  }

  /**
   * Initialize the Grok provider
   */
  async initialize() {
    try {
      this.logger.info('Initializing Grok provider...'); // crucial
      this.logger.debug('Provider config:', this.config);
      const browserConfig = {
        headless: this.config.headless,
        timeout: this.config.timeout,
        userDataDir: this.config.userDataDir,
        minimizeWindow: true, // Minimize window since not headless
        debug: true // Force debug for browser manager
      };
      this.browserManager = new BrowserManager(browserConfig);
      await this.browserManager.initialize();

      this.logger.info('Navigating to Grok...', { url: this.urls.chat });
      await this.browserManager.navigateToUrl(this.urls.chat);
      this.logger.debug('Grok navigation completed');

      // Don't check for text area here - let generateContent handle session validation
      // This allows for proper login flow on CI runners without existing sessions
      this.isLoggedIn = false; // Will be set to true during ensureSessionValid
      this.isInitialized = true;
      this.logger.info('Grok provider initialized successfully');
    } catch (error) {
      this.logger.error('Provider initialization failed', {
        error: error.message,
        stack: error.stack,
        originalError: error.originalError ? {
          message: error.originalError.message,
          stack: error.originalError.stack
        } : undefined
      });
      throw await this.handleError(error, 'initialization');
    }
  }

  /**
   * Generate content using Grok
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Generation options
   */
  async generateContent(prompt, options = {}) {
    await this.applyRateLimit();
    const startTime = Date.now();
    try {
      if (this.config.debug) this.logger.debug('Starting content generation', {
        promptLength: prompt.length,
      });
      if (this.config.debug) this.logger.debug('Validating prompt...');
      this.validatePrompt(prompt);
      if (this.config.debug) this.logger.debug('Prompt validated successfully');
      if (this.config.debug) this.logger.debug('Ensuring session is valid...');
      await this.ensureSessionValid();
      if (this.config.debug) this.logger.debug('Session validation completed');
      if (this.config.debug) this.logger.info('Sending prompt to Grok', {
        promptLength: prompt.length,
        options,
      });

      const currentUrl = await this.browserManager.getCurrentUrl();
      if (this.config.debug) this.logger.debug('Current URL before navigation check', { currentUrl });
      if (!currentUrl.includes('grok.com')) {
        if (this.config.debug) this.logger.debug('Navigating to chat URL', { url: this.urls.chat });
        await this.browserManager.navigateToUrl(this.urls.chat);
      }

      // Handle any popups first (simplified approach)
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

      // Find and prepare input (simplified approach)
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

        // Paste the prompt using direct value assignment for performance
        await this.browserManager.page.evaluate((prompt) => {
          const textarea = document.querySelector('textarea');
          if (textarea) {
            textarea.value = prompt;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return;
          }
          const contenteditable = document.querySelector('[contenteditable="true"]');
          if (contenteditable) {
            contenteditable.textContent = prompt;
            contenteditable.dispatchEvent(new Event('input', { bubbles: true }));
            return;
          }
        }, prompt);
        if (this.config.debug) this.logger.debug('Prompt pasted successfully');

        // Submit the prompt - try Enter key first
        await this.browserManager.page.keyboard.press('Enter');
        if (this.config.debug) this.logger.debug('Submitted with Enter key');

        // Wait for response
        const response = await this.waitForResponse(options);

        const duration = Date.now() - startTime;
        const validatedResponse = this.validateResponse(response);
        this.logRequest(prompt, validatedResponse, duration, options);
        return validatedResponse;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error('Content generation failed', {
          duration,
          error: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        });
        throw await this.handleError(error, 'content generation');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Content generation failed', {
        duration,
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      });
      throw await this.handleError(error, 'content generation');
    }
  }

  /**
   * Wait for Grok response to appear (simplified version)
   * @param {Object} options - Wait options
   */
  async waitForResponse(options = {}) {
    const timeout = options.timeout || 120000; // Increased to 2 minutes for CI
    const startTime = Date.now();

    this.logger.debug('Waiting for Grok response...');

    try {
      // Simple approach: wait for any response text to appear
      let response = '';
      const maxWaitTime = timeout;
      const checkInterval = 2000; // Check every 2 seconds

      for (let elapsed = 0; elapsed < maxWaitTime; elapsed += checkInterval) {
        try {
          // Check if we have any response content - use Grok-specific selectors
          const currentResponse = await this.browserManager.page.evaluate(() => {
            // Look for Grok assistant response elements specifically
            // Find all message bubbles and identify the last assistant message
            const messageBubbles = Array.from(document.querySelectorAll('div.message-bubble'));

            // Filter for assistant messages (not user messages)
            // Assistant messages typically don't contain the user's input text
            const assistantMessages = messageBubbles.filter(bubble => {
              const text = bubble.textContent?.trim() || '';
              const isVisible = bubble.offsetParent !== null;
              const hasContent = text.length > 0; // Allow any content, even short responses

              // Skip if this looks like user input (contains the question we just asked)
              // This is a heuristic - look for messages that don't start with simple questions
              const looksLikeUserInput = text.startsWith('What is') ||
                                        text.startsWith('Explain') ||
                                        text.startsWith('How') ||
                                        text.startsWith('Translate') ||
                                        text.startsWith('Calculate') ||
                                        text.startsWith('Solve');

              return isVisible && hasContent && !looksLikeUserInput &&
                     !text.includes('window.__') &&
                     !text.includes('document.');
            });

            // Get the last assistant message (most recent response)
            if (assistantMessages.length > 0) {
              const lastMessage = assistantMessages[assistantMessages.length - 1];
              return lastMessage.textContent?.trim() || '';
            }

            // Fallback: look for response-content-markdown that doesn't contain user input
            const markdownElements = Array.from(document.querySelectorAll('div.response-content-markdown'));
            const assistantMarkdowns = markdownElements.filter(el => {
              const text = el.textContent?.trim() || '';
              const isVisible = el.offsetParent !== null;
              const hasContent = text.length > 0; // Allow any content

              // Skip user inputs
              const looksLikeUserInput = text.startsWith('What is') ||
                                        text.startsWith('Explain') ||
                                        text.startsWith('How') ||
                                        text.startsWith('Translate') ||
                                        text.startsWith('Calculate') ||
                                        text.startsWith('Solve');

              return isVisible && hasContent && !looksLikeUserInput;
            });

            if (assistantMarkdowns.length > 0) {
              const lastMarkdown = assistantMarkdowns[assistantMarkdowns.length - 1];
              return lastMarkdown.textContent?.trim() || '';
            }

            // Additional fallback: look for any content in assistant message containers
            const assistantContainers = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
            if (assistantContainers.length > 0) {
              const lastContainer = assistantContainers[assistantContainers.length - 1];
              const text = lastContainer.textContent?.trim() || '';
              if (text.length > 0) {
                return text;
              }
            }

            return '';
          });

          if (currentResponse && currentResponse.trim().length > 0) {
            response = currentResponse.trim();
            this.logger.debug('Response found', { length: response.length });
            break;
          }

          // Check for error messages
          const errorFound = await this.browserManager.page.evaluate(() => {
            const errorSelectors = [
              '[class*="error"]',
              '[class*="Error"]',
              'div[role="alert"]',
              '.text-red-500',
              '.text-red-600',
            ];
            for (const selector of errorSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent && element.textContent.trim()) {
                return element.textContent.trim();
              }
            }
            return null;
          });

          if (errorFound) {
            throw new Error(`Grok returned error: ${errorFound}`);
          }

          await this.browserManager.delay(checkInterval);
        } catch (error) {
          if (error.message.includes('Grok returned error')) {
            throw error;
          }
          // Continue polling on other errors
          this.logger.debug('Error during response check, continuing to poll', { error: error.message });
          await this.browserManager.delay(checkInterval);
        }
      }

      if (!response) {
        throw new Error(`No response received within ${timeout}ms timeout`);
      }

      const duration = Date.now() - startTime;
      this.logger.debug('Response received', { duration, responseLength: response.length });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to get response', { duration, error: error.message });
      throw error;
    }
  }

  /**
   * Wait for typing animation to complete
   */
  async waitForTypingComplete() {

      let extractedResponse = null;
      let usedStrategy = null;

      // Try multiple extraction strategies for Grok
      const extractionStrategies = [
        {
          name: 'grok-assistant-message-bubble',
          selector: 'div.message-bubble:not([class*="bg-surface"]):not([class*="border"])',
        },
        {
          name: 'grok-response-markdown',
          selector: 'div.response-content-markdown',
        },
        {
          name: 'grok-assistant-container',
          selector: '[data-message-author-role="assistant"]',
        },
        {
          name: 'grok-message-bubble-any',
          selector: 'div.message-bubble',
        },
        {
          name: 'grok-markdown-any',
          selector: '.markdown, .prose',
        },
      ];

      for (const strategy of extractionStrategies) {
        try {
          this.logger.debug(`Trying extraction strategy: ${strategy.name}`, {
            selector: strategy.selector,
          });

          const elements = await this.browserManager.page.$$eval(
            strategy.selector,
            (elements) => {
              // For each element, try to get all available text content
              return elements.map((el) => {
                // Try different methods to extract text
                let text = '';

                if (el.tagName === 'DIV' && el.hasAttribute('data-message-author-role')) {
                  // For message containers, get all text including nested elements
                  text = el.innerText || el.textContent || '';
                } else {
                  // Prefer innerText (renders as visible), fall back to textContent
                  text = el.innerText || el.textContent || '';
                }

                return {
                  text: text,
                  html: el.innerHTML?.substring(0, 200) || '',
                  tagName: el.tagName,
                  className: el.className,
                };
              }).filter((item) => item.text.trim().length > 0); // Allow any non-empty text
            }
          );

          this.logger.debug(`Strategy ${strategy.name} results`, {
            count: elements.length,
            elements: elements.map((e) => ({
              textPreview: e.text.substring(0, 100),
              tagName: e.tagName,
              className: e.className,
            })),
          });

          if (elements.length > 0) {
            // Get the last element (most recent response)
            const lastElement = elements[elements.length - 1];

            // Filter out obviously wrong content (page scripts, etc.)
            if (
              !lastElement.text.includes('window.__') &&
              !lastElement.text.includes('document.') &&
              !lastElement.text.includes('__oai_') &&
              lastElement.text.trim().length > 0 // Allow any non-empty text, including short answers like "4"
            ) {
              extractedResponse = lastElement.text.trim();
              usedStrategy = strategy.name;
              this.logger.debug('Successfully extracted response', {
                strategy: strategy.name,
                responseLength: extractedResponse.length,
              });
              break;
            } else {
              this.logger.debug('Filtered out invalid content', {
                strategy: strategy.name,
                contentPreview: lastElement.text.substring(0, 100),
                reason: 'Contains page scripts or too short',
              });
            }
          }
        } catch (error) {
          this.logger.debug(`Strategy ${strategy.name} failed`, {
            error: error.message,
          });
        }
      }

      if (!extractedResponse) {
        // Last resort: try to get any text content from conversation turns
        this.logger.warn(
          'All extraction strategies failed, trying last resort...'
        );

        const lastResortContent = await this.browserManager.page.evaluate(
          () => {
            const turns = document.querySelectorAll(
              '[data-testid*="conversation-turn"]'
            );
            if (turns.length >= 2) {
              // Get the last turn (should be assistant response)
              const lastTurn = turns[turns.length - 1];

              // Try multiple ways to extract text
              const methods = {
                textContent: lastTurn.textContent || '',
                innerText: lastTurn.innerText || '',
                innerHTML: lastTurn.innerHTML.substring(0, 500) || '',
              };

              // Also try to find all divs with text content
              const allDivs = Array.from(lastTurn.querySelectorAll('div, p, span'))
                .map(el => (el.textContent || el.innerText || '').trim())
                .filter(text => text && text.length > 0 && !text.includes('window.__'));

              // Get all text nodes
              const textNodes = [];
              const walk = document.createTreeWalker(
                lastTurn,
                NodeFilter.SHOW_TEXT,
                null
              );
              let node;
              while (node = walk.nextNode()) {
                const text = node.textContent?.trim();
                if (text && text.length > 0) {
                  textNodes.push(text);
                }
              }

              const allText = (lastTurn.textContent || lastTurn.innerText || '').trim();

              // Try to find the actual response by looking for patterns
              let responseText = '';

              // If we only have "Grok said:" but there are other divs, try those
              if ((allText === 'Grok said:' || allText === 'Grok said') && allDivs.length > 0) {
                // Skip any div that is just "ChatGPT said:" and get the next ones
                const responseOnly = allDivs.filter(div =>
                  !div.toLowerCase().includes('chatgpt') &&
                  !div.toLowerCase().includes('assistant') &&
                  !div.toLowerCase().includes('said:')
                );
                if (responseOnly.length > 0) {
                  responseText = responseOnly[responseOnly.length - 1];
                }
              }

              if (!responseText) {
                responseText = allText;
              }

              return {
                fullText: allText,
                textNodes: textNodes,
                allDivs: allDivs,
                responseText: responseText,
                methods: methods,
              };
            }
            return null;
          }
        );

        if (lastResortContent && lastResortContent.responseText) {
          extractedResponse = lastResortContent.responseText;
          usedStrategy = 'last-resort';
          this.logger.debug('Last resort extraction succeeded', {
            strategy: 'last-resort',
            responseLength: extractedResponse.length,
            fullTextPreview: lastResortContent.fullText?.substring(0, 100),
            allDivsCount: lastResortContent.allDivs?.length,
            allDivsPreview: lastResortContent.allDivs?.slice(0, 5),
            textNodesCount: lastResortContent.textNodes?.length,
            responseText: lastResortContent.responseText?.substring(0, 100),
          });
        }
      }

      // If still no response, check if this is a headless rendering issue
      if (!extractedResponse || extractedResponse === 'ChatGPT said:' || extractedResponse === 'ChatGPT said') {
        this.logger.warn('HEADLESS MODE: No content found with standard extraction, trying page-wide search');

        // Try to find the response anywhere on the page
        const pageWideSearch = await this.browserManager.page.evaluate(() => {
          // Get all text from the page except common UI elements
          const bodyText = document.body.innerText || document.body.textContent || '';

          // Find lines that look like responses (not UI text)
          const lines = bodyText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

          // Filter out common UI elements
          const uiKeywords = ['send', 'message', 'new chat', 'settings', 'upgrade', 'edit', 'copy', 'delete', 'regenerate', 'continue'];
          const responseLines = lines.filter(line => {
            const lower = line.toLowerCase();
            return !uiKeywords.some(kw => lower === kw || lower.startsWith(kw + ' '));
          });

          return responseLines;
        });

        if (pageWideSearch && pageWideSearch.length > 0) {
          // Find the most likely response (usually one of the last meaningful lines)
          const candidateResponse = pageWideSearch[pageWideSearch.length - 1];
          if (candidateResponse && candidateResponse.length > 0 && candidateResponse !== 'ChatGPT said:') {
            extractedResponse = candidateResponse;
            usedStrategy = 'page-wide-search-headless';
            this.logger.debug('Found response via page-wide search', {
              response: extractedResponse.substring(0, 100),
              totalLines: pageWideSearch.length
            });
          }
        }
      }

      if (!extractedResponse) {
        throw new Error(
          'No valid response text found with any extraction strategy'
        );
      }

      // Check if response indicates still generating - wait longer
      if (extractedResponse && (
        extractedResponse.toLowerCase().includes('still generating') ||
        extractedResponse.toLowerCase().includes('generating a response') ||
        extractedResponse.toLowerCase().includes('chatgpt is still')
      )) {
        this.logger.warn('Response indicates still generating, waiting 5 seconds and retrying extraction...', {
          currentResponse: extractedResponse.substring(0, 100)
        });
        await this.browserManager.delay(5000);

        // Retry extraction with the same strategies
        extractedResponse = null;
        usedStrategy = null;

        for (const strategy of extractionStrategies) {
          try {
            this.logger.debug(`Retrying extraction strategy: ${strategy.name}`, {
              selector: strategy.selector,
            });

            const elements = await this.browserManager.page.$$eval(
              strategy.selector,
              (elements) => {
                return elements.map((el) => {
                  let text = '';

                  if (el.tagName === 'DIV' && el.hasAttribute('data-message-author-role')) {
                    text = el.innerText || el.textContent || '';
                  } else {
                    text = el.innerText || el.textContent || '';
                  }

                  return {
                    text: text,
                    html: el.innerHTML?.substring(0, 200) || '',
                    tagName: el.tagName,
                    className: el.className,
                  };
                }).filter((item) => item.text.trim().length > 0);
              }
            );

            if (elements.length > 0) {
              const lastElement = elements[elements.length - 1];

              if (
                !lastElement.text.includes('window.__') &&
                !lastElement.text.includes('document.') &&
                !lastElement.text.includes('__oai_') &&
                lastElement.text.trim().length > 0
              ) {
                extractedResponse = lastElement.text.trim();
                usedStrategy = strategy.name + '-retry';
                this.logger.debug('Successfully extracted response on retry', {
                  strategy: strategy.name + '-retry',
                  responseLength: extractedResponse.length,
                });
                break;
              }
            }
          } catch (error) {
            this.logger.debug(`Retry strategy ${strategy.name} failed`, {
              error: error.message,
            });
          }
        }

        // If still no response or still generating, try page-wide search again
        if (!extractedResponse || extractedResponse.toLowerCase().includes('still generating') || extractedResponse.toLowerCase().includes('generating a response')) {
          this.logger.warn('Retry extraction still indicates generating, trying page-wide search again');
          const pageWideSearch = await this.browserManager.page.evaluate(() => {
            const bodyText = document.body.innerText || document.body.textContent || '';
            const lines = bodyText.split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0);

            const uiKeywords = ['send', 'message', 'new chat', 'settings', 'upgrade', 'edit', 'copy', 'delete', 'regenerate', 'continue'];
            const responseLines = lines.filter(line => {
              const lower = line.toLowerCase();
              return !uiKeywords.some(kw => lower === kw || lower.startsWith(kw + ' '));
            });

            return responseLines;
          });

          if (pageWideSearch && pageWideSearch.length > 0) {
            const candidateResponse = pageWideSearch[pageWideSearch.length - 1];
            if (candidateResponse && candidateResponse.length > 0 && candidateResponse !== 'ChatGPT said:' &&
                !candidateResponse.toLowerCase().includes('still generating') &&
                !candidateResponse.toLowerCase().includes('generating a response')) {
              extractedResponse = candidateResponse;
              usedStrategy = 'page-wide-search-retry';
              this.logger.debug('Found response via page-wide search on retry', {
                response: extractedResponse.substring(0, 100),
                totalLines: pageWideSearch.length
              });
            }
          }
        }

        if (!extractedResponse) {
          throw new Error('No valid response found even after retry');
        }
      }

      const duration = Date.now() - startTime;
  }

  /**
   * Wait for typing animation to complete
   */
  async waitForTypingComplete() {
    const maxWait = 90000; // Increased to 90s for CI environments
    const pollInterval = 500; // Check every 500ms
    const start = Date.now();

    this.logger.debug('Waiting for typing animation to complete...');

    // First wait a minimum time for response to start
    await this.browserManager.delay(2000);

    let previousContentLength = 0;
    let stableCount = 0;
    const stableThreshold = 3; // Need 3 consecutive checks with same content length

    while (Date.now() - start < maxWait) {
      try {
        const status = await this.browserManager.page.evaluate(() => {
          // Check for stop button (appears during generation)
          const stopButton = document.querySelector('[data-testid="stop-button"]') ||
                           document.querySelector('button[aria-label*="Stop"]');

          // Check if send button is disabled
          const sendButton = document.querySelector('[data-testid="send-button"]') ||
                           document.querySelector('button[data-testid="send-button"]');

          // Check the ARIA live region for generation status (most reliable in headless)
          const liveRegion = document.querySelector('[aria-live="assertive"]');
          const liveRegionText = liveRegion ? (liveRegion.textContent || '').toLowerCase() : '';
          const isStillGenerating = liveRegionText.includes('generating') || liveRegionText.includes('still');

          // Check for substantial content in the last assistant message
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
          const lastMessage = assistantMessages[assistantMessages.length - 1];
          const content = lastMessage ? (lastMessage.textContent || lastMessage.innerText || '') : '';
          const contentLength = content.trim().length;
          const hasSubstantialContent = contentLength > 10; // Lower threshold

          // Most important: check the live region first - if it says "still generating", we're not done
          if (isStillGenerating) {
            return { status: 'typing', contentLength, reason: 'live-region-says-generating' };
          }

          // If stop button is gone AND we have some content, we're done
          if (!stopButton && hasSubstantialContent) {
            return { status: 'complete', contentLength, reason: 'no-stop-button-has-content' };
          }

          // If stop button exists or send button is disabled, still generating
          if (stopButton || (sendButton && sendButton.disabled)) {
            return { status: 'typing', contentLength, reason: 'stop-button-exists' };
          }

          // If we have substantial content but no stop button, we're done
          if (hasSubstantialContent) {
            return { status: 'complete', contentLength, reason: 'has-substantial-content' };
          }

          return { status: 'waiting', contentLength, reason: 'no-content-yet' }; // No substantial content yet
        });

        this.logger.debug('Typing status check', { status: status.status, contentLength: status.contentLength, reason: status.reason });

        // Check if content has stabilized (stopped changing)
        if (status.contentLength === previousContentLength && status.contentLength > 0) {
          stableCount++;
          this.logger.debug('Content stable check', { stableCount, contentLength: status.contentLength });

          // If content hasn't changed for a few checks, consider it done
          if (stableCount >= stableThreshold) {
            this.logger.debug('Content has stabilized - marking as complete', {
              contentLength: status.contentLength,
              stableCount
            });
            return;
          }
        } else {
          stableCount = 0; // Reset if content changed
          previousContentLength = status.contentLength;
        }

        if (status.status === 'complete') {
          this.logger.debug('Typing animation completed', { contentLength: status.contentLength, reason: status.reason });
          return;
        } else if (status.status === 'typing') {
          this.logger.debug('Still generating response...', { contentLength: status.contentLength, reason: status.reason });
        } else {
          this.logger.debug('Waiting for response content...', { contentLength: status.contentLength });
        }

        await this.browserManager.delay(pollInterval);
      } catch (error) {
        this.logger.warn('Error checking typing status', {
          error: error.message,
        });
        await this.browserManager.delay(pollInterval);
      }
    }

    this.logger.warn('Typing animation check timed out - proceeding with extraction');
  }

  /**
   * Wait for assistant message content to be populated (critical for headless mode)
   */
  async waitForAssistantContent() {
    const maxWait = 90000; // 90 seconds for headless mode
    const pollInterval = 500; // Check every 500ms
    const start = Date.now();

    this.logger.debug('Waiting for assistant message content to be populated...');

    while (Date.now() - start < maxWait) {
      try {
        const contentStatus = await this.browserManager.page.evaluate(() => {
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
          if (assistantMessages.length === 0) {
            return { hasAssistantMessage: false, contentLength: 0 };
          }

          const lastMessage = assistantMessages[assistantMessages.length - 1];

          // Check for React-rendered content in data attributes
          const reactContent = lastMessage.querySelector('[data-start], [data-end]');
          if (reactContent) {
            const reactText = reactContent.textContent || reactContent.innerText || '';
            if (reactText.trim().length > 0) {
              return {
                hasAssistantMessage: true,
                contentLength: reactText.trim().length,
                content: reactText.trim().substring(0, 100),
                hasActualContent: true,
                source: 'react-data'
              };
            }
          }

          // Check for markdown/prose content
          const markdownContent = lastMessage.querySelector('.markdown, .prose, p');
          if (markdownContent) {
            const markdownText = markdownContent.textContent || markdownContent.innerText || '';
            if (markdownText.trim().length > 0 && markdownText.trim() !== 'ChatGPT said:') {
              return {
                hasAssistantMessage: true,
                contentLength: markdownText.trim().length,
                content: markdownText.trim().substring(0, 100),
                hasActualContent: true,
                source: 'markdown'
              };
            }
          }

          // Check all text in the message container
          const allText = lastMessage.textContent || lastMessage.innerText || '';
          const textContent = allText.trim();

          // Filter out "ChatGPT said:" which is just UI text
          if (textContent && textContent !== 'ChatGPT said:' && textContent !== 'ChatGPT said') {
            return {
              hasAssistantMessage: true,
              contentLength: textContent.length,
              content: textContent.substring(0, 100),
              hasActualContent: true,
              source: 'textContent'
            };
          }

          return {
            hasAssistantMessage: true,
            contentLength: textContent.length,
            content: textContent.substring(0, 100),
            hasActualContent: false,
            source: 'textContent'
          };
        });

        if (contentStatus.hasAssistantMessage && contentStatus.hasActualContent) {
          this.logger.debug('Assistant message content populated', {
            contentLength: contentStatus.contentLength,
            contentPreview: contentStatus.content,
            source: contentStatus.source
          });
          return;
        }

        this.logger.debug('Waiting for assistant content...', {
          hasAssistantMessage: contentStatus.hasAssistantMessage,
          contentLength: contentStatus.contentLength,
          contentPreview: contentStatus.content
        });

        await this.browserManager.delay(pollInterval);
      } catch (error) {
        this.logger.warn('Error checking assistant content', {
          error: error.message,
        });
        await this.browserManager.delay(pollInterval);
      }
    }

    this.logger.warn('Assistant content wait timed out - proceeding with extraction anyway');
  }

  /**
   * Ensure user is logged in to ChatGPT
   */
  async ensureLoggedIn() {
    if (this.isLoggedIn && this.isSessionValid()) {
      return;
    }

    this.logger.info('Checking Grok login status...');

    try {
      // Navigate to chat page first
      await this.browserManager.navigateToUrl(this.urls.chat);

      // Check if we're already logged in by looking for the text area
      try {
        await this.browserManager.waitForElement(this.selectors.textArea, {
          timeout: 5000,
        });
        this.isLoggedIn = true;
        this.lastSessionCheck = Date.now();
        this.logger.info('Already logged in to Grok');
        return;
      } catch (error) {
        this.logger.info('Not logged in, need to authenticate');
      }

      // If we have credentials, attempt automatic login
      if (this.config.email && this.config.password) {
        await this.performLogin();
      } else {
        // Manual login required
        this.logger.warn('No credentials provided. Manual login required.');
        this.logger.info('Please login manually and then continue...');

        // Wait for manual login (detect when text area appears)
        await this.browserManager.waitForElement(this.selectors.textArea, {
          timeout: 300000, // 5 minutes for manual login
        });

        this.isLoggedIn = true;
        this.lastSessionCheck = Date.now();
        this.logger.info('Manual login completed');
      }
    } catch (error) {
      throw await this.handleError(error, 'login process');
    }
  }

  /**
   * Perform automatic login
   */
  async performLogin() {
    this.logger.info('Attempting automatic login...');

    try {
      // Navigate to login page
      await this.browserManager.navigateToUrl(this.urls.login);

      // Wait for and fill email
      await this.browserManager.waitForElement(this.selectors.emailInput);
      await this.browserManager.typeText(
        this.selectors.emailInput,
        this.config.email
      );

      // Continue to password
      await this.browserManager.clickElement(this.selectors.submitButton);

      // Wait for and fill password
      await this.browserManager.waitForElement(this.selectors.passwordInput);
      await this.browserManager.typeText(
        this.selectors.passwordInput,
        this.config.password
      );

      // Submit login
      await this.browserManager.clickElement(this.selectors.submitButton);

      // Wait for successful login (text area appears)
      await this.browserManager.waitForElement(this.selectors.textArea, {
        timeout: 30000,
      });

      this.isLoggedIn = true;
      this.lastSessionCheck = Date.now();
      this.logger.info('Automatic login successful');
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Check if current session is still valid
   */
  isSessionValid() {
    const now = Date.now();
    return now - this.lastSessionCheck < this.sessionTimeout;
  }

  /**
   * Ensure session is valid, refresh if needed
   */
  async ensureSessionValid() {
    // First check time-based expiration
    if (!this.isSessionValid()) {
      this.logger.info('Session expired (time-based), refreshing...');
      this.isLoggedIn = false;
      await this.ensureLoggedIn();
      return;
    }

    // Also check if text area is still accessible (element-based validation)
    try {
      await this.browserManager.waitForElement(this.selectors.textArea, {
        timeout: 3000,
      });
      this.logger.debug('Session valid - text area accessible');
      // Update last check time since element is available
      this.lastSessionCheck = Date.now();
    } catch (error) {
      this.logger.warn('Session invalid - text area not found, refreshing session', {
        error: error.message,
      });
      this.isLoggedIn = false;
      // Try to recover by navigating back to chat page
      await this.browserManager.navigateToUrl(this.urls.chat);

      // Wait for text area to appear after navigation
      try {
        await this.browserManager.waitForElement(this.selectors.textArea, {
          timeout: 10000,
        });
        this.isLoggedIn = true;
        this.lastSessionCheck = Date.now();
        this.logger.info('Session recovered after navigation');
      } catch (recoveryError) {
        this.logger.error('Session recovery failed, need full re-login', {
          error: recoveryError.message,
        });
        await this.ensureLoggedIn();
      }
    }
  }

  /**
   * Reset browser state by navigating to a fresh chat page
   */
  async resetBrowserState() {
    try {
      this.logger.debug('Resetting browser state...');
      // Navigate directly to home to get a fresh chat
      await this.browserManager.navigateToUrl('https://grok.com/');
      await this.browserManager.delay(2000);

      // Wait for the text area to be available
      await this.browserManager.waitForElement(this.selectors.textArea, {
        timeout: 10000,
      });
      this.logger.debug('Browser state reset complete');
    } catch (error) {
      this.logger.warn('Failed to reset browser state', {
        error: error.message,
      });
    }
  }

  /**
   * Start a new chat to ensure clean conversation state
   */
  async startNewChat() {
    try {
      // Try multiple selectors for the "New chat" button
      const newChatSelectors = [
        '[data-testid="new-chat-button"]',
        'button[data-testid="new-chat-button"]',
        'a[href="/"]',
        'button:has(svg):first-child', // Often the first button with an icon
        '[aria-label*="New chat"]',
        'button[aria-label*="New chat"]'
      ];

      let newChatClicked = false;
      for (const selector of newChatSelectors) {
        try {
          await this.browserManager.waitForElement(selector, { timeout: 3000 });
          await this.browserManager.clickElement(selector);
          this.logger.debug('New chat button clicked', { selector });
          newChatClicked = true;

          // Wait for the page to reset and text area to appear
          await this.browserManager.waitForElement(this.selectors.textArea, { timeout: 10000 });
          this.logger.debug('New chat started successfully');
          break;
        } catch (error) {
          this.logger.debug('New chat selector failed, trying next', {
            selector,
            error: error.message,
          });
        }
      }

      if (!newChatClicked) {
        this.logger.debug('Could not find new chat button, assuming we are already in a fresh state');
      }
    } catch (error) {
      this.logger.warn('Failed to start new chat, continuing with current state', {
        error: error.message,
      });
    }
  }

  /**
   * Check if ChatGPT is healthy and responsive
   */
  async isHealthy() {
    try {
      if (!this.browserManager || !(await this.browserManager.isHealthy())) {
        this.logger.debug('Browser manager not healthy');
        return false;
      }

      // If we're not initialized yet, we can't be healthy
      if (!this.isInitialized) {
        this.logger.debug('Provider not initialized');
        return false;
      }

      // Check if we can access the chat interface
      const currentUrl = await this.browserManager.getCurrentUrl();
      if (!currentUrl.includes('chatgpt.com')) {
        this.logger.debug('Not on ChatGPT page', { currentUrl });
        return false;
      }

      // If we're logged in and session is valid, we're healthy
      if (this.isLoggedIn && this.isSessionValid()) {
        this.logger.debug('Logged in with valid session');
        return true;
      }

      // Try to check if text area is available (indicates we're logged in)
      try {
        await this.browserManager.waitForElement(this.selectors.textArea, {
          timeout: 2000, // Short timeout for health check
        });

        // Update login status if we found the text area
        this.isLoggedIn = true;
        this.lastSessionCheck = Date.now();
        this.logger.debug('Text area found, updating login status');
        return true;
      } catch (error) {
        this.logger.debug('Text area not found', { error: error.message });
        return false;
      }
    } catch (error) {
      this.logger.error('Health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await super.cleanup();

    // if (this.browserManager) {
    //     if (this.removeCache) await this.browserManager.cleanupCache();
    //     await this.browserManager.close();
    //     this.browserManager = null;
    // }

    if (this.browserManager) {
        await this.browserManager.close();
        if (this.removeCache) await this.browserManager.cleanupCache();
        this.browserManager = null;
    }

    this.isLoggedIn = false;
    this.lastSessionCheck = 0;
}

  /**
   * Check for and handle "Continue manually" or similar authentication prompts
   */
  async handleContinueManuallyPrompt(maxWaitMs = 5000) {
    try {
      const pollInterval = 500;
      const maxTries = Math.ceil(maxWaitMs / pollInterval);

      for (let attempt = 0; attempt < maxTries; attempt++) {
        // Check for various popup types
        const popupInfo = await this.browserManager.page.evaluate(() => {
          const popups = {
            loginModal: document.querySelector('[data-testid="login-modal"], .modal, [role="dialog"]'),
            stayLoggedOut: Array.from(document.querySelectorAll('a')).find(
              (link) => link.textContent?.toLowerCase().includes('stay logged out') && link.offsetParent !== null
            ),
            stayLoggedOutExact: document.querySelector('a.text-token-text-secondary.mt-5.cursor-pointer.text-sm.font-semibold.underline'),
            continueButton: Array.from(document.querySelectorAll('button')).find(
              (btn) => btn.textContent?.toLowerCase().includes('continue') && btn.offsetParent !== null
            ),
            closeButton: document.querySelector('[data-testid="close-button"], .close, [aria-label*="Close"], [aria-label*="close"]'),
            dismissButton: Array.from(document.querySelectorAll('button')).find(
              (btn) => btn.textContent?.toLowerCase().includes('dismiss') && btn.offsetParent !== null
            ),
          };

          return {
            hasPopup: Object.values(popups).some(popup => popup !== null),
            popups: Object.fromEntries(
              Object.entries(popups).map(([key, element]) => [
                key,
                element ? {
                  text: element.textContent?.trim(),
                  tagName: element.tagName,
                  className: element.className,
                  isVisible: element.offsetParent !== null
                } : null
              ])
            )
          };
        });

        if (popupInfo.hasPopup) {
          this.logger.debug('Popup detected, attempting to handle', { popupInfo });

          let popupDismissed = false;

          // Try to click "Stay logged out" link first (exact selector)
          if (popupInfo.popups.stayLoggedOutExact) {
            try {
              await this.browserManager.page.click('a.text-token-text-secondary.mt-5.cursor-pointer.text-sm.font-semibold.underline');
              this.logger.debug('Clicked "Stay logged out" link (exact selector)');
              popupDismissed = true;
            } catch (error) {
              this.logger.debug('Failed to click exact "Stay logged out" selector', { error: error.message });
            }
          }

          // Try to click "Stay logged out" link (text-based)
          if (!popupDismissed && popupInfo.popups.stayLoggedOut) {
          try {
            await this.browserManager.page.evaluate(() => {
                const link = Array.from(document.querySelectorAll('a')).find(
                  (link) => link.textContent?.toLowerCase().includes('stay logged out') && link.offsetParent !== null
                );
                if (link) link.click();
              });
              this.logger.debug('Clicked "Stay logged out" link (text-based)');
              popupDismissed = true;
            } catch (error) {
              this.logger.debug('Failed to click "Stay logged out" link', { error: error.message });
            }
          }

          // Try to click continue button
          if (!popupDismissed && popupInfo.popups.continueButton) {
            try {
              await this.browserManager.page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(
                  (btn) => btn.textContent?.toLowerCase().includes('continue') && btn.offsetParent !== null
                );
                if (btn) btn.click();
              });
              this.logger.debug('Clicked continue button');
              popupDismissed = true;
            } catch (error) {
              this.logger.debug('Failed to click continue button', { error: error.message });
            }
          }

          // Try to click close/dismiss buttons (including X buttons)
          if (!popupDismissed && (popupInfo.popups.closeButton || popupInfo.popups.dismissButton)) {
            try {
              const closeSelectors = [
                '[data-testid="close-button"]',
                '.close',
                '[aria-label*="Close"]',
                '[aria-label*="close"]',
                'button[aria-label*="Close"]',
                'button[aria-label*="close"]',
                '[role="button"][aria-label*="Close"]',
                '[role="button"][aria-label*="close"]',
                'svg[data-icon="x"]',
                'svg[data-icon="X"]',
                'button svg[data-icon="x"]',
                'button svg[data-icon="X"]'
              ];

              for (const selector of closeSelectors) {
                try {
                  await this.browserManager.page.click(selector);
                  this.logger.debug('Clicked close button', { selector });
                  popupDismissed = true;
                  break;
                } catch (e) {
                  // Continue to next selector
                }
              }

              // Try JavaScript fallback for X buttons
              if (!popupDismissed) {
                try {
                  const clicked = await this.browserManager.page.evaluate(() => {
                    // Look for any button with X icon or close text
                    const closeButtons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(btn => {
                      const text = btn.textContent?.toLowerCase() || '';
                      const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                      return text.includes('close') || text.includes('x') || ariaLabel.includes('close') || ariaLabel.includes('x');
                    });

                    if (closeButtons.length > 0) {
                      closeButtons[0].click();
                      return true;
                    }
                    return false;
                  });
                  if (clicked) {
                    this.logger.debug('Clicked close button via JavaScript fallback');
                    popupDismissed = true;
                  }
                } catch (e) {
                  // Continue to next method
                }
              }
            } catch (error) {
              this.logger.debug('Failed to click close/dismiss buttons', { error: error.message });
            }
          }

          // Try to remove popup via JavaScript as last resort
          if (!popupDismissed) {
            try {
              await this.browserManager.page.evaluate(() => {
                const modals = document.querySelectorAll('[data-testid="login-modal"], .modal, [role="dialog"]');
                modals.forEach(modal => {
                  if (modal.style) {
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                  }
                  if (modal.remove) {
                    modal.remove();
                  }
                });
              });
              this.logger.debug('Removed popup via JavaScript');
              popupDismissed = true;
            } catch (error) {
              this.logger.debug('Failed to remove popup via JavaScript', { error: error.message });
            }
          }

          // After dismissing popup, wait for textarea to be accessible
          if (popupDismissed) {
            await this.browserManager.delay(500); // Give time for popup to disappear

            // Verify textarea is now accessible
            try {
              await this.browserManager.waitForElement(this.selectors.textArea, {
                timeout: 3000,
              });
              this.logger.debug('Popup dismissed and textarea is now accessible');
              return true;
            } catch (error) {
              this.logger.warn('Popup dismissed but textarea still not accessible', {
                error: error.message,
              });
              // Continue polling
            }
          }
        } else {
          // No popup, check if we can proceed (textarea is available)
          const canProceed = await this.browserManager.page.evaluate(() => {
            const textarea = document.querySelector('textarea[data-id="root"], #prompt-textarea, [data-testid="composer-text-input"]');
            return textarea && textarea.offsetParent !== null;
          });

          if (canProceed) {
            this.logger.debug('No popup blocking, textarea accessible');
            return true;
          }
        }

        await this.browserManager.delay(pollInterval);
      }

      // Final check: is textarea accessible now?
      const finalCheck = await this.browserManager.page.evaluate(() => {
        const textarea = document.querySelector('textarea[data-id="root"], #prompt-textarea, [data-testid="composer-text-input"]');
        const hasPopup = document.querySelector('[data-testid="login-modal"], .modal, [role="dialog"]') !== null;
        return {
          textareaAccessible: textarea && textarea.offsetParent !== null,
          hasPopup: hasPopup
        };
      });

      if (finalCheck.hasPopup) {
        this.logger.warn('Popup handling timeout - popup still present', { maxWaitMs });
      }

      if (!finalCheck.textareaAccessible) {
        this.logger.warn('Popup handling timeout - textarea not accessible', { maxWaitMs });
      }

      return finalCheck.textareaAccessible;
    } catch (error) {
      this.logger.error('Error handling popup', { error: error.message });
      return false;
    }
  }

  /**
   * Reset browser state by opening a fresh ChatGPT tab
   */
  async resetBrowserState() {
    this.logger.info('Resetting browser state - opening fresh ChatGPT tab');
    try {
      // Get current cookies before closing page to preserve session
      const cookies = await this.browserManager.page.cookies();
      this.logger.debug('Saved session cookies', { count: cookies.length });

      // Close current page and open fresh one
      if (this.browserManager.page) {
        await this.browserManager.page.close();
      }

      // Create new page
      this.browserManager.page = await this.browserManager.browser.newPage();

      // Restore cookies to preserve session
      if (cookies.length > 0) {
        await this.browserManager.page.setCookie(...cookies);
        this.logger.debug('Restored session cookies');
      }

      // Set user agent again
      await this.browserManager.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set timeouts
      this.browserManager.page.setDefaultTimeout(
        this.browserManager.config.timeout
      );
      this.browserManager.page.setDefaultNavigationTimeout(
        this.browserManager.config.timeout
      );

      // Navigate to ChatGPT
      await this.browserManager.navigateToUrl(this.urls.chat);

      // Wait for page to stabilize
      await this.browserManager.delay(1000);

      this.logger.info('Browser state reset completed');
    } catch (error) {
      this.logger.error('Failed to reset browser state', {
        error: error.message,
      });
      throw new Error(`Browser reset failed: ${error.message}`);
    }
  }
}

module.exports = GrokProvider;
