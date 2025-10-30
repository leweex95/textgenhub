/**
 * DeepSeek Provider - Browser automation for DeepSeek Chat web interface
 * Uses Puppeteer to interact with DeepSeek Chat when API access is not available
 */

'use strict';

const path = require('path');
const BaseLLMProvider = require('../core/base-provider');
const BrowserManager = require('../core/browser-manager');

class DeepSeekProvider extends BaseLLMProvider {
  constructor(config = {}) {
    super('deepseek', config);

    this.browserManager = null;
    this.isLoggedIn = false;
    this.sessionTimeout = config.sessionTimeout || 3600000; // 1 hour
    this.lastSessionCheck = 0;

    this.removeCache = config.removeCache !== undefined ? config.removeCache : true;

    // DeepSeek-specific selectors for UI interactions
    this.selectors = {
      textArea: 'textarea.ds-input, textarea[placeholder*="Type your message"], textarea[id*="deepseek-chat"][id*="input"]',
      sendButton: 'button[type="submit"], button[aria-label*="Send"], button[title*="Send"]',
      messageContainer: '[data-message], .message, .chat-message, div[class*="message"]',
      responseText: '.ds-message-content, [data-message-content], .message-content, .chat-content, div[class*="content"]',
      userMessage: '[data-role="user"], .user-message, div[class*="user"]',
      assistantMessage: '[data-role="assistant"], .assistant-message, div[class*="assistant"]',
      regenerateButton: 'button[aria-label*="Regenerate"], button[title*="Regenerate"], button[class*="regenerate"]',
      stopButton: 'button[aria-label*="Stop"], button[title*="Stop"], button[class*="stop"]',
      clearButton: 'button[aria-label*="New Chat"], button[title*="New Chat"], button[class*="new-chat"]',
      streamingResponse: '[data-streaming], .typing-indicator, .streaming, div[class*="typing"]',
      errorMessage: '[data-error], .error-message, .error, div[class*="error"]',
      consentDialog: '.fc-dialog.fc-choice-dialog',
      consentButton: '.fc-button.fc-cta-consent.fc-primary-button',
      ...config.selectors,
    };

    this.urls = {
      chat: 'https://chat-deep.ai/deepseek-chat/',
      ...config.urls,
    };

    // DeepSeek-specific configuration
    this.config.headless = config.headless !== undefined ? config.headless : true;
    this.config.timeout = config.timeout || 60000;
    this.config.sessionTimeout = config.sessionTimeout || 3600000;
    this.config.userDataDir =
      this.config.userDataDir || path.join(process.cwd(), 'temp', 'deepseek-session');
  }

  /**
   * Initialize the DeepSeek provider
   */
  async initialize() {
    try {
  this.logger.info('Initializing DeepSeek provider...'); // crucial
      const browserConfig = {
        headless: this.config.headless,
        timeout: this.config.timeout,
        userDataDir: this.config.userDataDir,
      };
      this.browserManager = new BrowserManager(browserConfig);
      await this.browserManager.initialize();

      // Navigate to DeepSeek Chat
  this.logger.info('Navigating to DeepSeek Chat...', { url: this.urls.chat }); // crucial
      await this.browserManager.navigateToUrl(this.urls.chat);
  if (this.config.debug) this.logger.info('DeepSeek Chat navigation completed');

      // Handle consent popup if it appears
      try {
  if (this.config.debug) this.logger.info('Checking for consent popup...');
        const consentDialog = await this.browserManager.page.$(this.selectors.consentDialog);
        
        if (consentDialog) {
          if (this.config.debug) this.logger.info('Consent popup found, clicking Consent button...');
          const consentButton = await this.browserManager.page.$(this.selectors.consentButton);
          
          if (consentButton) {
            await consentButton.click();
            if (this.config.debug) this.logger.info('Consent button clicked successfully');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            if (this.config.debug) this.logger.warn('Consent button not found in popup');
          }
        } else {
          if (this.config.debug) this.logger.info('No consent popup found');
        }
      } catch (error) {
  if (this.config.debug) this.logger.warn('Error handling consent popup:', error.message);
      }

      // Check for text area to confirm we're on the chat page
      try {
  if (this.config.debug) this.logger.info('Waiting for DeepSeek Chat interface...');
        
        let maxAttempts = 5;
        let attempt = 0;
        let success = false;

        while (attempt < maxAttempts && !success) {
          try {
            await this.browserManager.waitForElement(this.selectors.textArea, {
              timeout: 10000,
              visible: true
            });
            success = true;
          } catch (error) {
            attempt++;
            if (attempt === maxAttempts) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.browserManager.page.reload();
          }
        }

        this.isLoggedIn = true;
  if (this.config.debug) this.logger.info('DeepSeek Chat interface ready.');

      } catch (e) {
  this.logger.error('Failed to initialize DeepSeek Chat interface:', e);
        throw new Error('Could not access DeepSeek Chat interface. Please check the website availability.');
      }

      this.isInitialized = true;
  if (this.config.debug) this.logger.info('DeepSeek provider initialized successfully');
    } catch (error) {
      throw await this.handleError(error, 'initialization');
    }
  }

  /**
   * Generate content using DeepSeek Chat
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Generation options
   * @returns {Promise<string>} The generated response
   */
  async generateContent(prompt, options = {}) {
    if (!this.isInitialized) {
      throw await this.handleError(new Error('DeepSeek provider not initialized. Call initialize() first.'), 'content generation');
    }

    const startTime = Date.now();
    try {
      if (this.config.debug) this.logger.debug('Starting content generation', {
        promptLength: prompt.length,
      });

  if (this.config.debug) this.logger.debug('Validating prompt...');
      this.validatePrompt(prompt);
  if (this.config.debug) this.logger.debug('Prompt validated successfully');

  if (this.config.debug) this.logger.info('Sending prompt to DeepSeek Chat', {
        promptLength: prompt.length,
        options,
      });

      // Clear any existing text and type the prompt
  if (this.config.debug) this.logger.debug('Typing prompt into text area');
      try {
        const textArea = await this.browserManager.waitForElement(this.selectors.textArea);
        await textArea.click({ clickCount: 3 }); // Select all existing text
        await textArea.press('Backspace'); // Clear existing text
        await textArea.type(prompt, { delay: 50 });
  if (this.config.debug) this.logger.debug('Prompt input completed successfully');
      } catch (error) {
  this.logger.error('Failed to input prompt text', {
          error: error.message,
        });
        throw new Error(`Cannot input prompt: ${error.message}`);
      }

      // Send the message
  if (this.config.debug) this.logger.debug('Attempting to send message via send button');
      const sendButtonSelectors = [
        'button.ds-send-btn',
        'button[type="submit"]',
        'button[aria-label*="Send"]',
        'button[title*="Send"]'
      ];

      let sendButtonFound = false;
      for (const selector of sendButtonSelectors) {
        try {
          await this.browserManager.waitForElement(selector, { timeout: 3000 });
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
          const textArea = await this.browserManager.waitForElement(this.selectors.textArea);
          await textArea.focus();
          await new Promise(resolve => setTimeout(resolve, 500));
          await textArea.press('Enter');
          this.logger.debug('Message sent via Enter key');
          sendButtonFound = true;
        } catch (error) {
          this.logger.error('Enter key fallback also failed', { error: error.message });
        }
      }

      if (!sendButtonFound) {
        this.logger.error('All send methods failed - DeepSeek interface may have changed');
        throw new Error('Cannot send message - DeepSeek interface may have changed');
      }

      // Wait for response to appear
      this.logger.debug('Waiting for response...');
      const response = await this.waitForResponse(options);
      
      const duration = Date.now() - startTime;
      const validatedResponse = this.validateResponse(response);
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
   * Wait for DeepSeek response to appear
   * @param {Object} options - Wait options
   */
  async waitForResponse(options = {}) {
    const timeout = options.timeout || 60000; // 1 minute default
    const startTime = Date.now();

    this.logger.debug('Waiting for DeepSeek response...');

    try {
      // Wait for response to start appearing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for typing animation to complete
      await this.waitForTypingComplete();

      // Additional wait after typing complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try multiple extraction strategies
      const extractionStrategies = [
        {
          name: 'ds-message-content',
          selector: '.ds-message-content'
        },
        {
          name: 'assistant-message-last',
          selector: '[data-role="assistant"]:last-child .content, .assistant-message:last-child .content'
        },
        {
          name: 'message-content-last',
          selector: '.message-content:last-child'
        },
        {
          name: 'chat-content-last',
          selector: '.chat-content:last-child'
        },
        {
          name: 'response-content',
          selector: 'div[class*="response"]:last-child, div[class*="assistant"]:last-child'
        }
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
                .filter((item) => item.text.trim().length > 10)
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
            const lastElement = elements[elements.length - 1];

            // Filter out unwanted content (Copy, Retry buttons, UI elements)
            const text = this.cleanResponseText(lastElement.text);
            
            if (text && text.trim().length > 0) {
              extractedResponse = text.trim();
              usedStrategy = strategy.name;
              this.logger.debug('Successfully extracted response', {
                strategy: strategy.name,
                responseLength: extractedResponse.length,
              });
              break;
            }
          }
        } catch (error) {
          this.logger.debug(`Strategy ${strategy.name} failed`, {
            error: error.message,
          });
        }
      }

      if (!extractedResponse) {
        throw new Error('No valid response text found with any extraction strategy');
      }

      const duration = Date.now() - startTime;
      
      this.logger.info('Response extracted successfully', {
        responseLength: extractedResponse.length,
        extractionTime: `${duration}ms`,
      });

      return extractedResponse;
    } catch (error) {
      throw new Error(`Failed to get response: ${error.message}`);
    }
  }

  /**
   * Clean response text by removing Copy/Retry buttons and UI elements
   * @param {string} text - Raw response text
   * @returns {string} Cleaned response text
   */
  cleanResponseText(text) {
    if (!text) return '';

    // Remove common UI elements and button text
    const uiPatterns = [
      /\bCopy\b/gi,
      /\bRetry\b/gi,
      /\bTry again\b/gi,
      /\bRegenerate\b/gi,
      /\bEdit\b/gi,
      /\bShare\b/gi,
      /\bSave\b/gi,
      /\bDownload\b/gi,
      /Chat Settings/gi,
      /Chat Options/gi,
      /Clear Chat/gi,
      /Export/gi,
      /Font Size/gi,
      /Small|Medium|Large/gi,
      /Display/gi,
      /Type your message/gi,
      /Send a message/gi,
      /Consent/gi,
      /Manage options/gi,
      /Learn more/gi,
      /^\s*Copy\s*$/gm,
      /^\s*Retry\s*$/gm,
      /^\s*Try again\s*$/gm
    ];

    let cleanedText = text;
    
    // Apply filters
    for (const pattern of uiPatterns) {
      cleanedText = cleanedText.replace(pattern, '');
    }

    // Remove extra whitespace and normalize
    cleanedText = cleanedText
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/^\s+|\s+$/g, '') // Trim start/end
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    return cleanedText;
  }

  /**
   * Wait for typing animation to complete
   */
  async waitForTypingComplete() {
    const maxWait = 60000; // Max 60s
    const pollInterval = 500;
    const start = Date.now();

    this.logger.debug('Waiting for typing animation to complete...');

    while (Date.now() - start < maxWait) {
      try {
        const isTyping = await this.browserManager.page.evaluate(() => {
          // Look for typing indicators
          const typingIndicators = [
            '[data-streaming]',
            '.typing-indicator',
            '.streaming',
            'div[class*="typing"]',
            '[aria-label*="typing"]'
          ];

          for (const selector of typingIndicators) {
            if (document.querySelector(selector)) {
              return true;
            }
          }

          // Check if send button is disabled
          const sendButton = document.querySelector('button[type="submit"]');
          if (sendButton && sendButton.disabled) {
            return true;
          }

          return false;
        });

        if (!isTyping) {
          this.logger.debug('Typing animation completed');
          return;
        }

        this.logger.debug('Still generating response...');
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        this.logger.warn('Error checking typing status', {
          error: error.message,
        });
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    this.logger.warn('Typing animation check timed out');
  }

  /**
   * Validate prompt input
   * @param {string} prompt - The prompt to validate
   */
  validatePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a non-empty string');
    }
    if (prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty');
    }
    if (prompt.length > 32000) {
      throw new Error('Prompt is too long (max 32000 characters)');
    }
  }

  /**
   * Validate response
   * @param {string} response - The response to validate
   * @returns {string} Validated response
   */
  validateResponse(response) {
    if (!response || typeof response !== 'string') {
      throw new Error('Invalid response received');
    }
    if (response.trim().length === 0) {
      throw new Error('Empty response received');
    }
    return response.trim();
  }

  /**
   * Handle errors in the DeepSeek provider
   * Simply delegates to parent which saves HTML artifacts
   */
  async handleError(error, operation) {
    // Reset session state on any error for safety
    this.isLoggedIn = false;
    this.lastSessionCheck = 0;
    
    // Parent handleError saves HTML and returns wrapped error
    return await super.handleError(error, operation);
  }

  /**
   * Check if an error is recoverable
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is recoverable
   */
  isRecoverableError(error) {
    const recoverableErrors = [
      'TimeoutError',
      'net::ERR_NETWORK_CHANGED',
      'net::ERR_INTERNET_DISCONNECTED',
      'net::ERR_CONNECTION_RESET',
      'Navigation timeout',
    ];

    return recoverableErrors.some(e => error.message.includes(e));
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.browserManager && this.browserManager.browser) {
        await this.browserManager.browser.close();
      }
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = DeepSeekProvider;