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
        const artifactDir = path.join(process.cwd(), 'artifacts');
        if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
        const htmlPath = path.join(artifactDir, `chatgpt_manual_${reason}_${Date.now()}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');
        this.logger.error(`Saved manual HTML artifact: ${htmlPath}`);
        return htmlPath;
      }
    } catch (err) {
      this.logger.error('Failed to save manual HTML artifact', { error: err.message });
    }
    return null;
  }
/**
 * ChatGPT Provider - Browser automation for ChatGPT web interface
 * Uses Puppeteer to interact with ChatGPT when API access is not available
 */

'use strict';

const path = require('path');
const fs = require('fs');
const BaseLLMProvider = require('../core/base-provider');
const BrowserManager = require('../core/browser-manager');

class ChatGPTProvider extends BaseLLMProvider {

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
        const artifactDir = path.join(process.cwd(), 'artifacts');
        if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
        const htmlPath = path.join(artifactDir, `chatgpt_manual_${reason}_${Date.now()}.html`);
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
    super('chatgpt', config);

  this.browserManager = null;
  this.isLoggedIn = false;
  this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hour
  this.lastSessionCheck = 0;

  // Force debug mode for investigation
  this.config.debug = true;

  this.removeCache = config.removeCache !== undefined ? config.removeCache : true;
  this.continuous = config.continuous !== undefined ? config.continuous : false;

    // ChatGPT-specific selectors (may need updates as UI changes)
    this.selectors = {
      loginButton: '[data-testid="login-button"]',
      emailInput: '#username',
      passwordInput: '#password',
      submitButton: 'button[type="submit"]',
      textArea:
        '#prompt-textarea, [data-testid="composer-text-input"], textarea[placeholder*="Message"], textarea[data-id="root"]',
      sendButton:
        '[data-testid="send-button"], button[data-testid="send-button"], [aria-label*="Send"], button[aria-label*="Send"], button[type="submit"]:not([disabled]), button:has(svg):last-child',
      messageContainer:
        '[data-testid*="conversation-turn"], [data-testid="conversation-turn"], .group, .flex.flex-col, div[class*="conversation"]',
      responseText:
        '[data-testid*="conversation-turn"] .markdown, [data-testid*="conversation-turn"] div[class*="markdown"], .prose, div[class*="prose"], .whitespace-pre-wrap',
      regenerateButton:
        '[data-testid="regenerate-button"], button[aria-label*="Regenerate"]',
      ...config.selectors,
    };

    this.urls = {
      login: 'https://chatgpt.com/auth/login',
      chat: 'https://chatgpt.com/',
      ...config.urls,
    };

    // ChatGPT-specific configuration with configurable headless mode
    this.config.headless =
      config.headless !== undefined ? config.headless : true; // Default to headless
    this.config.timeout = config.timeout || 60000;
    this.config.sessionTimeout = config.sessionTimeout || 3600000;
    this.config.userDataDir =
      this.config.userDataDir || path.join(process.cwd(), 'temp', 'chatgpt-session');
  }

  /**
   * Initialize the ChatGPT provider
   */
  async initialize() {
    try {
      this.logger.info('Initializing ChatGPT provider...'); // crucial
      this.logger.debug('Provider config:', this.config);
      const browserConfig = {
        headless: this.config.headless,
        timeout: this.config.timeout,
        userDataDir: this.config.userDataDir,
        debug: true // Force debug for browser manager
      };
      this.browserManager = new BrowserManager(browserConfig);
      await this.browserManager.initialize();

      this.logger.info('Navigating to ChatGPT...', { url: this.urls.chat });
      await this.browserManager.navigateToUrl(this.urls.chat);
      this.logger.debug('ChatGPT navigation completed');

      // Try to find the text area, if not found, fail fast instead of hanging
      try {
        this.logger.info('Waiting for ChatGPT text area...');
        await this.browserManager.waitForElement(this.selectors.textArea, {
          timeout: 10000, // Reduced timeout for faster failure
        });
        this.isLoggedIn = true;
        this.logger.info('ChatGPT text area found, session is logged in.');
      } catch (e) {
        this.logger.error('ChatGPT login required but not available in headless mode. Please run with --debug flag for manual login.', {
          error: e.message,
          stack: e.stack
        });
        throw new Error('ChatGPT login required. Run with --debug flag for manual login or ensure you have a valid session.');
      }
      this.isInitialized = true;
      this.logger.info('ChatGPT provider initialized successfully');
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
   * Generate content using ChatGPT
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
      if (this.config.debug) this.logger.info('Sending prompt to ChatGPT', {
        promptLength: prompt.length,
        options,
      });

      const currentUrl = await this.browserManager.getCurrentUrl();
      if (this.config.debug) this.logger.debug('Current URL before navigation check', { currentUrl });
      if (!currentUrl.includes('chatgpt.com')) {
        if (this.config.debug) this.logger.debug('Navigating to chat URL', { url: this.urls.chat });
        await this.browserManager.navigateToUrl(this.urls.chat);
      }

      // Try to find text area, reset browser state if not found
      if (this.config.debug) this.logger.debug('Waiting for text area', {
        selector: this.selectors.textArea,
      });
      
      let textAreaFound = false;
      const maxAttempts = 2;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await this.browserManager.waitForElement(this.selectors.textArea, {
            timeout: 10000,
          });
          if (this.config.debug) this.logger.debug('Text area found', { attempt });
          textAreaFound = true;
          break;
        } catch (error) {
          if (attempt < maxAttempts) {
            if (this.config.debug) this.logger.warn(`Text area not found on attempt ${attempt}, resetting browser state`, {
              error: error.message,
            });
            await this.resetBrowserState();
          } else {
            if (this.config.debug) this.logger.error(`Text area not found after ${maxAttempts} attempts`, {
              error: error.message,
            });
            throw error;
          }
        }
      }
      
      if (!textAreaFound) {
        throw new Error('Text area not found after multiple attempts');
      }

      // Check for modal before typing prompt
      await this.handleContinueManuallyPrompt();

      // Clear any existing text and type the prompt
      if (this.config.debug) this.logger.debug('Typing prompt into text area');
      
      let promptSet = false;
      const maxPromptAttempts = 3;
      
      for (let attempt = 1; attempt <= maxPromptAttempts; attempt++) {
        try {
          // Ensure text area is still available
          await this.browserManager.waitForElement(this.selectors.textArea, {
            timeout: 5000,
          });
          
          await this.browserManager.setTextValue(this.selectors.textArea, prompt);
          if (this.config.debug) this.logger.debug('Prompt set using direct value method', { attempt });
          promptSet = true;
          break;
        } catch (error) {
          if (attempt < maxPromptAttempts) {
            this.logger.warn(`Failed to set prompt on attempt ${attempt}, retrying...`, {
              error: error.message,
            });
            // Check for popups that might have appeared
            await this.handleContinueManuallyPrompt();
            // Small delay before retry
            await this.browserManager.delay(1000);
          } else {
            this.logger.error('Failed to set prompt text after all attempts', {
              error: error.message,
            });
            throw new Error(`Cannot input prompt after ${maxPromptAttempts} attempts: ${error.message}`);
          }
        }
      }
      
      if (!promptSet) {
        throw new Error('Failed to set prompt text');
      }
      
      this.logger.debug('Prompt input completed successfully');

      // Check for modal after typing prompt
      await this.handleContinueManuallyPrompt();

      // Send the message
      this.logger.debug('Attempting to send message via send button', {
        selector: this.selectors.sendButton,
      });
      const sendButtonSelectors = [
        '[data-testid="send-button"]',
        'button[data-testid="send-button"]',
        '[aria-label*="Send"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]:not([disabled])',
        'button:has(svg):last-child',
      ];

      let sendButtonFound = false;
      for (const selector of sendButtonSelectors) {
        try {
          await this.browserManager.waitForElement(selector, { timeout: 5000 });
          await this.browserManager.clickElement(selector);
          this.logger.debug('Send button clicked successfully', { selector });
          sendButtonFound = true;
          break;
        } catch (error) {
          this.logger.debug('Send button selector failed, trying next', {
            selector,
            error: error.message,
          });
        }
      }

      if (!sendButtonFound) {
        this.logger.warn('All send button selectors failed, trying Enter key fallback');
        try {
          // Focus on text area and press Enter
          await this.browserManager.page.focus(this.selectors.textArea);
          await this.browserManager.delay(500);
          await this.browserManager.page.keyboard.press('Enter');
          this.logger.debug('Message sent via Enter key');
          sendButtonFound = true;
        } catch (error) {
          this.logger.error('Enter key fallback also failed', { error: error.message });
        }
      }

      if (!sendButtonFound) {
        this.logger.error(
          'All send methods failed - ChatGPT interface may have changed'
        );
        throw new Error(
          'Cannot send message - ChatGPT interface may have changed'
        );
      }

      // Check for modal after clicking send (in case it appears late)
      await this.handleContinueManuallyPrompt();

      // Wait for response to appear
      this.logger.debug('Waiting for response...');
      const response = await this.waitForResponse(options);
      console.log(JSON.stringify({ response }));

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
  }

  /**
   * Wait for ChatGPT response to appear
   * @param {Object} options - Wait options
   */
  async waitForResponse(options = {}) {
    const timeout = options.timeout || 60000; // 1 minute default
    const startTime = Date.now();

    this.logger.debug('Waiting for ChatGPT response...');

    try {
      // Wait for the response container to appear and be populated
      await this.browserManager.waitForElement(
        this.selectors.messageContainer,
        {
          timeout: timeout,
        }
      );

      // Wait for typing animation to complete
      await this.waitForTypingComplete();

      // Reduce extra wait after typing complete
      await this.browserManager.delay(300);

      // Debug: Let's see what's actually on the page
      const pageInfo = await this.browserManager.page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasConversation: !!document.querySelector(
            '[data-testid*="conversation-turn"]'
          ),
          conversationTurns: document.querySelectorAll(
            '[data-testid*="conversation-turn"]'
          ).length,
          lastTurnContent: document
            .querySelector('[data-testid*="conversation-turn"]:last-child')
            ?.textContent?.substring(0, 200),
        };
      });

      this.logger.debug('Page analysis for response extraction', pageInfo);

      // Take a screenshot before extraction for debugging
      try {
        const artifactsDir = path.join(process.cwd(), 'artifacts');
        if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
        const screenshotPath = path.join(artifactsDir, `chatgpt-before-extraction-${Date.now()}.png`);
        await this.browserManager.page.screenshot({ path: screenshotPath, fullPage: true });
        this.logger.debug('Screenshot saved for debugging', { path: screenshotPath });
      } catch (e) {
        this.logger.debug('Failed to take screenshot before extraction', { error: e.message });
      }

      // Try multiple extraction strategies
      const extractionStrategies = [
        {
          name: 'conversation-turn-assistant',
          selector:
            '[data-testid*="conversation-turn"]:last-child [data-message-author-role="assistant"]',
        },
        {
          name: 'conversation-turn-last',
          selector:
            '[data-testid*="conversation-turn"]:last-child .markdown, [data-testid*="conversation-turn"]:last-child .prose',
        },
        {
          name: 'assistant-message',
          selector: '[data-message-author-role="assistant"]:last-child',
        },
        {
          name: 'markdown-content',
          selector: '.markdown:last-child, .prose:last-child',
        },
        {
          name: 'original-selectors',
          selector: this.selectors.responseText,
        },
      ];

      let extractedResponse = null;
      let usedStrategy = null;

      for (const strategy of extractionStrategies) {
        try {
          this.logger.debug(`Trying extraction strategy: ${strategy.name}`, {
            selector: strategy.selector,
          });

          const elements = await this.browserManager.page.$$eval(
            strategy.selector,
            (elements) =>
              elements
                .map((el) => ({
                  text: el.textContent || el.innerText || '',
                  html: el.innerHTML?.substring(0, 200) || '',
                  tagName: el.tagName,
                  className: el.className,
                }))
                .filter((item) => item.text.trim().length > 0) // Allow any non-empty text, including short answers like "4"
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
              
              // If we only have "ChatGPT said:" but there are other divs, try those
              if ((allText === 'ChatGPT said:' || allText === 'ChatGPT said') && allDivs.length > 0) {
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

      if (!extractedResponse) {
        throw new Error(
          'No valid response text found with any extraction strategy'
        );
      }

      const duration = Date.now() - startTime;
      
      // Validate extracted response - if it's suspiciously short or just a label, save HTML for debugging
      if (extractedResponse && (
        extractedResponse.length < 2 ||
        extractedResponse === 'ChatGPT said:' ||
        extractedResponse === 'ChatGPT said' ||
        extractedResponse.toLowerCase().includes('said:') && extractedResponse.length < 30
      )) {
        this.logger.warn('Extracted response looks suspicious, saving HTML artifact for debugging', {
          responseLength: extractedResponse.length,
          responsePreview: extractedResponse.substring(0, 100),
        });
        
        try {
          const html = await this.browserManager.page.content();
          const fs = require('fs');
          const path = require('path');
          const artifactDir = path.join(process.cwd(), 'artifacts');
          if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
          const htmlPath = path.join(artifactDir, `chatgpt_suspicious_response_${Date.now()}.html`);
          fs.writeFileSync(htmlPath, html, 'utf8');
          this.logger.error(`Saved HTML artifact due to suspicious response: ${htmlPath}`);
        } catch (htmlErr) {
          this.logger.error('Failed to save HTML artifact', { error: htmlErr.message });
        }
      }
      
      this.logger.info('Response extracted successfully', {
        responseLength: extractedResponse.length,
        extractionTime: `${duration}ms`,
      });

      return extractedResponse;
    } catch (error) {
      // Take screenshot for debugging
      await this.browserManager.takeScreenshot(
        `chatgpt-error-${Date.now()}.png`
      );
      throw new Error(`Failed to get response: ${error.message}`);
    }
  }

  /**
   * Wait for typing animation to complete
   */
  async waitForTypingComplete() {
    const maxWait = 60000; // Max 60s
    const pollInterval = 150;
    const start = Date.now();

    this.logger.debug('Waiting for typing animation to complete...');

    while (Date.now() - start < maxWait) {
      try {
        // Check if there's a typing indicator or if send button is disabled
        const isTyping = await this.browserManager.page.evaluate(() => {
          // Look for common typing indicators
          const typingIndicators = [
            '[data-testid*="typing"]',
            '.typing-indicator',
            '[aria-label*="typing"]',
            '[data-testid="stop-button"]', // Stop button appears during generation
          ];

          for (const selector of typingIndicators) {
            if (document.querySelector(selector)) {
              return true;
            }
          }

          // Check if send button is disabled (indication of processing)
          const sendButtonSelectors = [
            '[data-testid="send-button"]',
            'button[data-testid="send-button"]',
            'button:has(svg):last-child',
          ];
          for (const selector of sendButtonSelectors) {
            const sendButton = document.querySelector(selector);
            if (sendButton && sendButton.disabled) {
              return true;
            }
          }

          // Check if there's actual content in the last response area
          const responseAreas = document.querySelectorAll(
            '[data-testid*="conversation-turn"]'
          );
          if (responseAreas.length > 0) {
            const lastResponse = responseAreas[responseAreas.length - 1];
            const content = lastResponse.textContent || lastResponse.innerText;
            if (content && content.trim().length > 10) {
              // Wait for substantial content
              return false; // Content is there, not typing anymore
            }
          }

          return true; // Still waiting for content
        });

        if (!isTyping) {
          this.logger.debug('Typing animation completed');
          return;
        }

        this.logger.debug('Still generating response...');
        await this.browserManager.delay(pollInterval);
      } catch (error) {
        this.logger.warn('Error checking typing status', {
          error: error.message,
        });
        await this.browserManager.delay(pollInterval);
      }
    }

    this.logger.warn('Typing animation check timed out');
  }

  /**
   * Ensure user is logged in to ChatGPT
   */
  async ensureLoggedIn() {
    if (this.isLoggedIn && this.isSessionValid()) {
      return;
    }

    this.logger.info('Checking ChatGPT login status...');

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
        this.logger.info('Already logged in to ChatGPT');
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

module.exports = ChatGPTProvider;
