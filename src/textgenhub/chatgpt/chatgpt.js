/**
 * ChatGPT Provider - Browser automation for ChatGPT web interface
 * Uses Puppeteer to interact with ChatGPT when API access is not available
 * 
 * IMPORTANT: This provider uses NON-HEADLESS mode (headless=false).
 * 
 * Reason: ChatGPT.com is a complex React SPA that doesn't properly render 
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
  this.sessionTimeout = config.sessionTimeout || 86400000; // 24 hours instead of 1 hour
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
    // IMPORTANT: ChatGPT responses don't render in headless mode, causing extraction failures
    // Default to non-headless (false) for reliability, can be overridden if needed
    this.config.headless =
      config.headless !== undefined ? config.headless : false;
    this.config.timeout = config.timeout || 60000;
    this.config.sessionTimeout = config.sessionTimeout || 86400000; // 24 hours instead of 1 hour
    this.config.userDataDir =
      this.config.userDataDir || path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
  }

  /**
   * Initialize the ChatGPT provider
   */
  async initialize() {
    try {
      this.logger.info('Initializing ChatGPT provider...'); // crucial
      this.logger.debug('Provider config:', this.config);

      this.logger.info('Using browser automation mode');
      
      // Check if Chrome is running with remote debugging, if not, start it
      const isChromeDebuggingEnabled = await this.checkChromeDebugging();
      if (!isChromeDebuggingEnabled) {
        this.logger.info('Starting Chrome with remote debugging enabled...');
        await this.startChromeWithDebugging();
        // Wait a moment for Chrome to start
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const browserConfig = {
        headless: this.config.headless,
        timeout: this.config.timeout,
        userDataDir: this.config.userDataDir,
        minimizeWindow: true, // Minimize window since not headless
        debug: true, // Force debug for browser manager
        connectToExisting: true, // Connect to existing Chrome session
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
      this.logger.debug('Attempting to send message', {
        headless: this.config.headless,
        selector: this.selectors.sendButton,
      });

      let sendButtonFound = false;

      // In headless mode, prioritize Enter key since send button may not render
      if (this.config.headless) {
        this.logger.debug('Headless mode detected, trying Enter key first');
        try {
          // Focus on text area and press Enter
          await this.browserManager.page.focus(this.selectors.textArea);
          await this.browserManager.delay(500);
          await this.browserManager.page.keyboard.press('Enter');
          this.logger.debug('Message sent via Enter key in headless mode');
          sendButtonFound = true;
        } catch (error) {
          this.logger.debug('Enter key failed in headless mode, trying send button selectors', {
            error: error.message,
          });
        }
      }

      // Try send button selectors if Enter key didn't work or not in headless mode
      if (!sendButtonFound) {
        const sendButtonSelectors = [
          '[data-testid="send-button"]',
          'button[data-testid="send-button"]',
          '[aria-label*="Send"]',
          'button[aria-label*="Send"]',
          'button[type="submit"]:not([disabled])',
          'button:has(svg):last-child',
          // Modern ChatGPT selectors
          'button[data-testid*="send"]',
          '[role="button"][aria-label*="Send"]',
          'button[class*="send"]',
          'svg[aria-label*="Send"]',
          // Fallback to any enabled button near textarea
          'form button:not([disabled])',
        ];

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
      }

      // Final fallback to Enter key if all else failed
      if (!sendButtonFound) {
        this.logger.warn('All send button selectors failed, trying Enter key fallback');
        try {
          // Focus on text area and press Enter
          await this.browserManager.page.focus(this.selectors.textArea);
          await this.browserManager.delay(500);
          await this.browserManager.page.keyboard.press('Enter');
          this.logger.debug('Message sent via Enter key fallback');
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

      // Add extra wait to ensure response is fully streamed, especially in CI
      await this.browserManager.delay(2000);

      // In headless mode, try to detect if we're actually getting a response
      // by checking DOM changes and network activity
      const isHeadless = this.config.headless === true || this.config.headless === 'new';
      if (isHeadless) {
        this.logger.debug('Running in headless mode - skipping additional detection (let waitForTypingComplete handle it)');
      }

      // Wait for assistant message content to be populated (critical for headless mode)
      // This will wait up to 90 seconds for content to appear
      await this.waitForAssistantContent();

      // Try to extract content from React component data or other sources
      const reactContent = await this.browserManager.page.evaluate(() => {
        // Try to find content in React component data
        const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (assistantMessages.length === 0) return null;

        const lastMessage = assistantMessages[assistantMessages.length - 1];

        // SPECIAL HEADLESS MODE CHECK:
        // In headless, elements might not have text content but have innerHTML
        // Check if element exists but is empty
        if (lastMessage.innerHTML && lastMessage.innerHTML.trim().length === 0) {
          // Element exists but has no HTML content - check for specific structure
          const hasChildElements = lastMessage.children && lastMessage.children.length > 0;
          return {
            type: 'empty-element-headless-mode',
            hasChildren: hasChildElements,
            innerHTML: lastMessage.innerHTML,
            childrenCount: lastMessage.children ? lastMessage.children.length : 0
          };
        }

        // Look for any element with data-start/data-end attributes (React rendering)
        const dataElements = lastMessage.querySelectorAll('[data-start], [data-end]');
        for (const el of dataElements) {
          const text = el.textContent || el.innerText || '';
          if (text && text.trim() && text.trim() !== 'ChatGPT said:' && text.trim() !== 'ChatGPT said') {
            return { type: 'data-element', content: text.trim() };
          }
        }

        // Try to access React fiber tree if available
        try {
          const reactKey = Object.keys(lastMessage).find(key => key.startsWith('__reactFiber'));
          if (reactKey) {
            const fiber = lastMessage[reactKey];
            if (fiber && fiber.memoizedProps && fiber.memoizedProps.children) {
              const content = typeof fiber.memoizedProps.children === 'string' ? fiber.memoizedProps.children : null;
              if (content && content.trim()) {
                return { type: 'react-fiber', content: content.trim() };
              }
            }
          }
        } catch (e) {
          // React fiber access might fail
        }

        // Look for any text content that looks like a response (not UI text)
        const allTextNodes = [];
        const walk = document.createTreeWalker(lastMessage, NodeFilter.SHOW_TEXT, null);
        let node;
        while (node = walk.nextNode()) {
          const text = node.textContent?.trim();
          if (text && text.length > 0 && text !== 'ChatGPT said:' && !text.includes('window.__')) {
            allTextNodes.push(text);
          }
        }

        // If we have text nodes, try to find the actual response
        if (allTextNodes.length > 0) {
          // Filter out UI text and find actual content
          const responseCandidates = allTextNodes.filter(text =>
            !text.toLowerCase().includes('chatgpt') &&
            !text.toLowerCase().includes('said:') &&
            text.length <= 100 // Reasonable response length
          );
          if (responseCandidates.length > 0) {
            return { type: 'text-nodes', content: responseCandidates[0] };
          }
        }

        return null;
      });

      if (reactContent) {
        if (reactContent.type === 'empty-element-headless-mode') {
          this.logger.warn('HEADLESS MODE ISSUE: Assistant element exists but is empty!', reactContent);
          // In this case, we need to trigger a refresh or find the content elsewhere
        } else {
          this.logger.debug('Found content via React inspection', {
            type: reactContent.type,
            content: reactContent.content?.substring(0, 50)
          });
          // Use this content directly instead of going through extraction strategies
          if (reactContent.content) {
            return reactContent.content;
          }
        }
      }

      // Debug: Check what assistant message elements actually exist
      const debugInfo = await this.browserManager.page.evaluate(() => {
        const allAssistantElements = document.querySelectorAll('[data-message-author-role]');
        const assistantElements = document.querySelectorAll('[data-message-author-role="assistant"]');
        const conversationTurns = document.querySelectorAll('[data-testid*="conversation-turn"]');
        
        // Get ALL text from page to see if response is anywhere
        const allPageText = document.body.textContent || '';
        const hasNumberFour = allPageText.includes('4') || allPageText.includes('four') || allPageText.includes('Four');

        return {
          allMessageRoles: Array.from(allAssistantElements).map(el => ({
            role: el.getAttribute('data-message-author-role'),
            text: (el.textContent || el.innerText || '').trim().substring(0, 50),
            hasContent: (el.textContent || el.innerText || '').trim().length > 0,
            innerHTML: el.innerHTML.substring(0, 200)
          })),
          assistantCount: assistantElements.length,
          conversationTurnsCount: conversationTurns.length,
          lastTurnHTML: conversationTurns.length > 0 ?
            conversationTurns[conversationTurns.length - 1].outerHTML.substring(0, 500) : null,
          allPageTextLength: allPageText.length,
          hasNumberFour: hasNumberFour,
          pageBodyFirstThousandChars: allPageText.substring(0, 1000)
        };
      });

      this.logger.debug('Assistant message debug info', debugInfo);

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
          name: 'react-data-attributes-expected-content',
          selector: '[data-message-author-role="assistant"] [data-end]:not([data-end="0"])',
          extractLogic: async (elements) => {
            // Special logic for elements with data-end suggesting content should be there
            for (const el of elements) {
              const dataEnd = el.getAttribute('data-end');
              if (dataEnd && parseInt(dataEnd) > 0) {
                // Wait a bit more for content to populate
                await this.browserManager.delay(2000);
                const text = el.textContent || el.innerText || '';
                if (text.trim().length > 0) {
                  return text.trim();
                }
                // If still empty, try to get content from parent or siblings
                const parent = el.parentElement;
                if (parent) {
                  const parentText = parent.textContent || parent.innerText || '';
                  if (parentText.trim().length > 0 && parentText.trim() !== 'ChatGPT said:') {
                    return parentText.trim();
                  }
                }
              }
            }
            return null;
          }
        },
        {
          name: 'react-data-attributes',
          selector: '[data-message-author-role="assistant"] [data-start], [data-message-author-role="assistant"] [data-end]',
        },
        {
          name: 'assistant-markdown-simple',
          selector: '[data-message-author-role="assistant"] .markdown, [data-message-author-role="assistant"] .prose',
        },
        {
          name: 'assistant-paragraph',
          selector: '[data-message-author-role="assistant"] p',
        },
        {
          name: 'conversation-turn-paragraph',
          selector: '[data-testid*="conversation-turn"]:last-child p',
        },
        {
          name: 'assistant-any-content',
          selector: '[data-message-author-role="assistant"]',
        },
        {
          name: 'conversation-turn-assistant-markdown',
          selector:
            '[data-testid*="conversation-turn"]:last-child [data-message-author-role="assistant"] .markdown, [data-testid*="conversation-turn"]:last-child [data-message-author-role="assistant"] .prose',
        },
        {
          name: 'assistant-message-markdown',
          selector: '[data-message-author-role="assistant"]:last-child .markdown, [data-message-author-role="assistant"]:last-child .prose',
        },
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
          name: 'assistant-message-full-text',
          selector: '[data-message-author-role="assistant"]:last-child *',
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

          // Check if strategy has custom extraction logic
          if (strategy.extractLogic) {
            const customResult = await strategy.extractLogic(await this.browserManager.page.$$(strategy.selector));
            if (customResult) {
              extractedResponse = customResult;
              usedStrategy = strategy.name;
              this.logger.debug('Successfully extracted response with custom logic', {
                strategy: strategy.name,
                responseLength: extractedResponse.length,
              });
              break;
            }
            continue; // Skip normal extraction for custom logic strategies
          }

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
          if (candidateResponse && candidateResponse.length > 0 && candidateResponse !== 'ChatGPT said:' && 
              !candidateResponse.toLowerCase().includes('still generating') && 
              !candidateResponse.toLowerCase().includes('generating a response')) {
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

      // Save HTML artifact after successful extraction for debugging
      try {
        const artifactsDir = path.join(process.cwd(), 'artifacts');
        if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
        const htmlPath = path.join(artifactsDir, `chatgpt_success_extraction_${Date.now()}.html`);
        const html = await this.browserManager.page.content();
        fs.writeFileSync(htmlPath, html, 'utf8');
        this.logger.debug('Saved HTML artifact after successful extraction', { path: htmlPath });
      } catch (e) {
        this.logger.debug('Failed to save HTML artifact after extraction', { error: e.message });
      }

      this.logger.debug('Response extraction completed', {
        usedStrategy: usedStrategy,
        responseLength: extractedResponse.length,
        responsePreview: extractedResponse.substring(0, 100),
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
    // AGGRESSIVE TIMEOUT: Max 60 seconds to wait for typing to complete
    // If it hasn't completed by then, save HTML and fail fast
    const maxWait = 60000; // 60 seconds max
    const pollInterval = 1000; // Check every second
    const start = Date.now();
    let timeoutSaveAttempted = false;

    this.logger.debug('Waiting for typing animation to complete...', { maxWait });

    // First wait a minimum time for response to start
    await this.browserManager.delay(3000);
    
    let previousContentLength = 0;
    let stableCount = 0;
    const stableThreshold = 2; // Very low threshold - 2 consecutive stable checks

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
          const isStillGenerating = liveRegionText.includes('generating') || 
                                  liveRegionText.includes('still') ||
                                  liveRegionText.includes('thinking');

          // Check for substantial content in the last assistant message
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');     
          const lastMessage = assistantMessages[assistantMessages.length - 1];
          let content = '';
          if (lastMessage) {
            // Try multiple ways to get content
            content = (lastMessage.textContent || lastMessage.innerText || '').trim();
            // Also check for markdown content
            const proseDiv = lastMessage.querySelector('.prose, .markdown');
            if (proseDiv) {
              content = (proseDiv.textContent || proseDiv.innerText || '').trim();
            }
          }
          const contentLength = content.length;
          const hasSubstantialContent = contentLength > 0; // Very low threshold - even "4" is enough

          // Most important: check the live region first - if it says "still generating", we're not done
          if (isStillGenerating) {
            return { status: 'typing', contentLength, reason: 'live-region-says-generating' };
          }

          // If stop button exists or send button is disabled, still generating
          if (stopButton || (sendButton && sendButton.disabled)) {
            return { status: 'typing', contentLength, reason: 'stop-button-exists' };
          }

          // If we have any content at all, we're done (for simple responses like "4")
          if (hasSubstantialContent) {
            return { status: 'complete', contentLength, reason: 'has-any-content' };
          }

          return { status: 'waiting', contentLength, reason: 'no-content-yet' }; // No content yet
        });

        const elapsedMs = Date.now() - start;
        this.logger.debug('Typing status check', { 
          status: status.status, 
          contentLength: status.contentLength, 
          reason: status.reason,
          elapsedMs 
        });

        // Save HTML if we're waiting too long (after 10 seconds with no content)
        if (elapsedMs > 10000 && status.status === 'waiting' && !timeoutSaveAttempted) {
          this.logger.warn('No content after 10 seconds, saving debug HTML', { elapsedMs });
          try {
            await this.saveHtmlArtifact('typing-timeout-10s');
            timeoutSaveAttempted = true;
          } catch (e) {
            this.logger.debug('Failed to save typing timeout HTML', { error: e.message });
          }
        }

        // Check if content has stabilized (stopped changing)
        if (status.contentLength === previousContentLength && status.contentLength > 0) {
          stableCount++;
          this.logger.debug('Content stable check', { stableCount, contentLength: status.contentLength });
          
          // If content hasn't changed for several checks, consider it done
          if (stableCount >= stableThreshold) {
            this.logger.debug('Content has stabilized - marking as complete', { 
              contentLength: status.contentLength,
              stableCount,
              elapsedMs
            });
            return;
          }
        } else {
          stableCount = 0; // Reset if content changed
          previousContentLength = status.contentLength;
        }

        if (status.status === 'complete') {
          this.logger.debug('Typing animation completed', { 
            contentLength: status.contentLength, 
            reason: status.reason,
            elapsedMs 
          });
          // Add a small delay to ensure content is fully rendered
          await this.browserManager.delay(1000);
          return;
        } else if (status.status === 'typing') {
          this.logger.debug('Still generating response...', { 
            contentLength: status.contentLength, 
            reason: status.reason,
            elapsedMs 
          });
        } else {
          this.logger.debug('Waiting for response content...', { 
            contentLength: status.contentLength,
            elapsedMs 
          });
        }

        await this.browserManager.delay(pollInterval);
      } catch (error) {
        this.logger.warn('Error checking typing status', {
          error: error.message,
        });
        await this.browserManager.delay(pollInterval);
      }
    }

    const elapsedTime = Date.now() - start;
    this.logger.error('TIMEOUT: Typing animation check exceeded maximum wait time', {
      elapsedMs: elapsedTime,
      maxWait
    });

    // Save HTML when timeout occurs
    try {
      await this.saveHtmlArtifact('typing-timeout-exceeded');
    } catch (e) {
      this.logger.debug('Failed to save typing timeout HTML artifact', { error: e.message });
    }

    throw new Error(`Response generation timeout after ${elapsedTime}ms - ChatGPT interface may be unresponsive`);
  }

  /**
   * Wait for assistant message content to be populated (critical for headless mode)
   */
  async waitForAssistantContent() {
    // INCREASED TIMEOUT: Wait longer for content to appear in DOM
    // ChatGPT uses dynamic rendering that may take time to populate
    // Use longer timeout in CI environments where responses may be slower
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const maxWait = isCI ? 120000 : (this.config.headless ? 30000 : 30000); // 2 minutes in CI, 30s locally
    const pollInterval = 500; // Check every 500ms
    const start = Date.now();
    let timeoutSaveAttempted = false;

    this.logger.debug('Waiting for assistant message content to be populated...', { maxWait, isCI });

    while (Date.now() - start < maxWait) {
      try {
        const contentStatus = await this.browserManager.page.evaluate(() => {
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
          if (assistantMessages.length === 0) {
            return { hasAssistantMessage: false, contentLength: 0 };
          }

          const lastMessage = assistantMessages[assistantMessages.length - 1];

          // Check for React-rendered content in data attributes (this is key for ChatGPT)
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
            // Even if empty, check if data-end attribute suggests content should be there
            const dataEnd = reactContent.getAttribute('data-end');
            if (dataEnd && parseInt(dataEnd) > 0) {
              return {
                hasAssistantMessage: true,
                contentLength: 0,
                content: '',
                hasActualContent: false,
                source: 'react-data-empty-but-expected',
                expectedLength: parseInt(dataEnd)
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

        // Special case: if we have data-end attribute suggesting content should be there but it's empty,
        // wait a bit longer as it might still be streaming
        if (contentStatus.source === 'react-data-empty-but-expected') {
          this.logger.debug('Detected expected content via data attributes, waiting for streaming to complete', {
            expectedLength: contentStatus.expectedLength
          });
          // Continue waiting in this case
        }

        const elapsedMs = Date.now() - start;
        if (elapsedMs > 10000 && !timeoutSaveAttempted) {
          // After 10 seconds of waiting with no content, save HTML for debugging
          this.logger.warn('Assistant content not appearing after 10 seconds, saving debug HTML', {
            elapsedMs,
            hasAssistantMessage: contentStatus.hasAssistantMessage,
            contentLength: contentStatus.contentLength,
            source: contentStatus.source
          });
          try {
            await this.saveHtmlArtifact('wait-timeout-10s');
            timeoutSaveAttempted = true;
          } catch (e) {
            this.logger.debug('Failed to save timeout HTML', { error: e.message });
          }
        }

        this.logger.debug('Waiting for assistant content...', {
          elapsedMs,
          hasAssistantMessage: contentStatus.hasAssistantMessage,
          contentLength: contentStatus.contentLength,
          contentPreview: contentStatus.content,
          source: contentStatus.source
        });

        await this.browserManager.delay(pollInterval);
      } catch (error) {
        this.logger.warn('Error checking assistant content', {
          error: error.message,
        });
        await this.browserManager.delay(pollInterval);
      }
    }

    const elapsedTime = Date.now() - start;
    this.logger.warn('Assistant content wait timeout - proceeding with extraction anyway', {
      elapsedMs: elapsedTime,
      maxWait,
      isCI
    });

    // Save HTML when timeout occurs for debugging
    try {
      await this.saveHtmlArtifact('wait-timeout-exceeded');
    } catch (e) {
      this.logger.debug('Failed to save timeout HTML artifact', { error: e.message });
    }
  }

  /**
   * Check if the current session is still valid based on time
   */
  isSessionValid() {
    const timeSinceLastCheck = Date.now() - this.lastSessionCheck;
    return timeSinceLastCheck < this.sessionTimeout;
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
    // For CI/testing, be more lenient with session validation
    // Only check time-based expiration if it's been more than 24 hours
    const timeSinceLastCheck = Date.now() - this.lastSessionCheck;
    if (timeSinceLastCheck > this.sessionTimeout) {
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
      await this.browserManager.navigateToUrl('https://chatgpt.com/');
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
                    modal.style.opacity = '0';
                    modal.style.pointerEvents = 'none';
                  }
                  // Don't remove the element, just hide it to avoid triggering navigation
                  // if (modal.remove) {
                  //   modal.remove();
                  // }
                });
              });
              this.logger.debug('Hidden popup via JavaScript (without removing element)');
              popupDismissed = true;
            } catch (error) {
              this.logger.debug('Failed to hide popup via JavaScript', { error: error.message });
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
   * Check if Chrome is running with remote debugging enabled
   */
  async checkChromeDebugging() {
    try {
      const net = require('net');
      return new Promise((resolve) => {
        const client = net.createConnection({ port: 9222, host: 'localhost' });
        client.on('connect', () => {
          client.end();
          resolve(true);
        });
        client.on('error', () => {
          resolve(false);
        });
        // Timeout after 1 second
        setTimeout(() => {
          client.destroy();
          resolve(false);
        }, 1000);
      });
    } catch (error) {
      this.logger.debug('Error checking Chrome debugging port', { error: error.message });
      return false;
    }
  }

  /**
   * Start Chrome with remote debugging enabled
   */
  async startChromeWithDebugging() {
    try {
      const { spawn } = require('child_process');
      const path = require('path');
      
      // Find Chrome executable path
      let chromePath = 'chrome';
      if (process.platform === 'win32') {
        const possiblePaths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];
        for (const p of possiblePaths) {
          if (require('fs').existsSync(p)) {
            chromePath = p;
            break;
          }
        }
      }

      // Use the same user data directory as configured
      const userDataDir = this.config.userDataDir || path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
      
      const chromeArgs = [
        `--remote-debugging-port=9222`,
        `--user-data-dir=${userDataDir}`,
        `--start-maximized`,
        `--no-first-run`,
        `--disable-default-apps`,
        `--disable-web-security`,
        `--disable-features=VizDisplayCompositor`
      ];

      this.logger.info('Starting Chrome with debugging', { chromePath, userDataDir });
      
      const chromeProcess = spawn(chromePath, chromeArgs, {
        detached: true,
        stdio: 'ignore'
      });

      // Don't wait for the process, let it run in background
      chromeProcess.unref();
      
      this.logger.info('Chrome started with remote debugging enabled');
    } catch (error) {
      this.logger.error('Failed to start Chrome with debugging', { error: error.message });
      throw new Error(`Could not start Chrome with debugging: ${error.message}`);
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
